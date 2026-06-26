"""Terrain layer — build a Digital Surface Model (DSM) from the point cloud.

The DSM is the height grid every visibility computation runs on. We also stamp the
58 oriented object boxes into it as solid occluders, so buildings/walls block
line-of-sight even where the cloud is sparse. Output is a georeferenced GeoTIFF
(UTM) — the authoritative, reusable layer — plus the arrays in memory.

    uv run python src/backend/terrain.py [--res 1.0]
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import MergeAlg
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy.ndimage import distance_transform_edt
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.io import read_ply  # noqa: E402

DATA = ROOT / "data"
BUILD = ROOT / "build"
# UTM zone is unconfirmed (looks like 32N / Bavaria) — analysis uses only the
# metric transform, so the EPSG is a label, overridable with --epsg.
DEFAULT_EPSG = 32632


def box_yaw(box: dict) -> float:
    """Yaw (rad) from the [0,0,qz,qw] quaternion."""
    return 2.0 * math.atan2(box["rotation"][2], box["rotation"][3])


def box_polygon(box: dict) -> Polygon:
    """Footprint of an oriented box as a world-coordinate (UTM) polygon."""
    cx, cy, _ = box["center"]
    lx, ly, _ = box["extent"]
    c, s = math.cos(box_yaw(box)), math.sin(box_yaw(box))
    hx, hy = lx / 2, ly / 2
    local = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    return Polygon([(cx + px * c - py * s, cy + px * s + py * c) for px, py in local])


def build_dsm(ply_path: Path, res: float = 1.0, boxes_path: Path | None = None,
              epsg: int = DEFAULT_EPSG) -> dict:
    v = read_ply(ply_path)
    x, y, z = (np.asarray(v[c]).astype(np.float64) for c in ("x", "y", "z"))
    xmin, xmax, ymin, ymax = float(x.min()), float(x.max()), float(y.min()), float(y.max())
    w = int(np.ceil((xmax - xmin) / res))
    h = int(np.ceil((ymax - ymin) / res))
    transform = from_origin(xmin, ymax, res, res)  # north-up

    col = np.clip(((x - xmin) / res).astype(np.int64), 0, w - 1)
    row = np.clip(((ymax - y) / res).astype(np.int64), 0, h - 1)
    flat = np.full(w * h, -np.inf)
    order = np.argsort(z, kind="stable")            # last write per cell = highest point
    flat[row[order] * w + col[order]] = z[order]
    dsm = flat.reshape(h, w)
    valid = np.isfinite(dsm)                          # cells with real cloud data
    dsm[~valid] = np.nan

    n_boxes = 0
    if boxes_path and boxes_path.exists():
        boxes = json.loads(boxes_path.read_text())
        shapes = [(box_polygon(b), b["center"][2] + b["extent"][2] / 2) for b in boxes]
        tops = rasterize(shapes, out_shape=(h, w), transform=transform, fill=np.nan,
                         dtype="float64", merge_alg=MergeAlg.replace)
        m = ~np.isnan(tops)
        base = np.where(np.isnan(dsm), -np.inf, dsm)
        dsm = np.where(m, np.maximum(base, tops), dsm)
        n_boxes = len(boxes)

    dsm = _fill_gaps(dsm)
    return {"dsm": dsm, "transform": transform, "res": res, "epsg": epsg,
            "bounds": (xmin, ymin, xmax, ymax), "shape": (h, w),
            "valid": valid, "n_boxes": n_boxes}


def _fill_gaps(dsm: np.ndarray) -> np.ndarray:
    nan = np.isnan(dsm)
    if nan.any():
        idx = distance_transform_edt(nan, return_distances=False, return_indices=True)
        dsm = dsm[tuple(idx)]
    return dsm


def world_to_pixel(transform: rasterio.Affine, x: float, y: float) -> tuple[int, int]:
    col, row = ~transform * (x, y)
    return int(row), int(col)


def save_geotiff(arr: np.ndarray, transform: rasterio.Affine, epsg: int, path: Path,
                 dtype: str = "float32") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    nodata = np.nan if dtype.startswith("float") else 0
    with rasterio.open(path, "w", driver="GTiff", height=arr.shape[0], width=arr.shape[1],
                       count=1, dtype=dtype, crs=CRS.from_epsg(epsg), transform=transform,
                       nodata=nodata, compress="deflate") as ds:
        ds.write(arr.astype(dtype), 1)


def main() -> None:
    ap = argparse.ArgumentParser(description="Build the DSM from the point cloud")
    ap.add_argument("--res", type=float, default=1.0, help="metres per cell")
    ap.add_argument("--epsg", type=int, default=DEFAULT_EPSG)
    ap.add_argument("--ply", type=Path, default=DATA / "point_cloud.ply")
    ap.add_argument("--boxes", type=Path, default=DATA / "bounding_boxes.json")
    args = ap.parse_args()

    t = build_dsm(args.ply, args.res, args.boxes, args.epsg)
    out = BUILD / "dsm.tif"
    save_geotiff(t["dsm"], t["transform"], t["epsg"], out)
    h, w = t["shape"]
    print(f"DSM {w}x{h} @ {args.res} m  | boxes stamped: {t['n_boxes']}  | "
          f"z {np.nanmin(t['dsm']):.1f}–{np.nanmax(t['dsm']):.1f} m  | coverage "
          f"{100 * t['valid'].mean():.0f}%")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
