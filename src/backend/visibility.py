"""Visibility layer — line-of-sight viewshed on the DSM.

The core Track-1 primitive. From an observer position, compute every cell it can
see, accounting for real surface height + the box occluders (so a shooter on a
roof sees over a wall, and dead ground behind a building is correctly hidden).

Radial sweep: cast rays out to max range, track the running max terrain elevation
angle; a cell is visible if the angle to a standing target there clears everything
closer. This is surface-accurate 2.5D visibility — honestly not volumetric.

    uv run python src/backend/visibility.py [--box 36_house] [--range 1200] [--arc 360]

Outputs: build/viewshed.tif (georeferenced) + build/viewshed.{bin,json}
(per web-cloud-point seen/not flag + observer; served by the FastAPI app at
/api/viewshed{,-info} for the viewer overlay).
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.app import MAX_POINTS, VOXEL, pack_cloud  # noqa: E402
from src.backend.terrain import BUILD, DATA, build_dsm, save_geotiff, world_to_pixel  # noqa: E402


def viewshed(dsm: np.ndarray, transform, res: float, obs_xy: tuple[float, float],
             obs_z: float | None = None, eye_h: float = 1.7, target_h: float = 1.7,
             max_range: float = 1200.0, facing_deg: float = 0.0,
             arc_deg: float = 360.0) -> tuple[np.ndarray, tuple[int, int], float]:
    h, w = dsm.shape
    orow, ocol = world_to_pixel(transform, *obs_xy)
    orow = int(np.clip(orow, 0, h - 1))
    ocol = int(np.clip(ocol, 0, w - 1))
    if obs_z is None:
        obs_z = float(dsm[orow, ocol])
    eye = obs_z + eye_h

    vis = np.zeros((h, w), dtype=bool)
    vis[orow, ocol] = True
    rng_cells = int(max_range / res)
    n_az = max(720, int(2 * np.pi * rng_cells))            # ~1-cell spacing at edge
    half = np.deg2rad(arc_deg / 2)
    centre = np.deg2rad(facing_deg)
    if arc_deg >= 360:
        azimuths = np.linspace(0, 2 * np.pi, n_az, endpoint=False)
    else:
        azimuths = np.linspace(centre - half, centre + half, max(2, int(n_az * arc_deg / 360)))
    t = np.arange(1, rng_cells + 1) * res
    ox, oy = obs_xy

    for a in azimuths:
        xs = ox + np.cos(a) * t
        ys = oy + np.sin(a) * t
        cols = ((xs - transform.c) / transform.a).astype(np.int64)
        rows = ((transform.f - ys) / (-transform.e)).astype(np.int64)
        ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
        if not ok.any():
            continue
        rr, cc, tt = rows[ok], cols[ok], t[ok]
        gh = dsm[rr, cc]
        terr_ang = (gh - eye) / tt                          # blocking angle (terrain top)
        tgt_ang = (gh + target_h - eye) / tt                # angle to a standing target
        run = np.maximum.accumulate(terr_ang)
        prev = np.empty_like(run)
        prev[0] = -np.inf
        prev[1:] = run[:-1]
        seen = tgt_ang >= prev
        vis[rr[seen], cc[seen]] = True
    return vis, (orow, ocol), eye


def _pick_observer(boxes_path: Path, box_id: str | None,
                   xy: tuple[float, float] | None) -> tuple[tuple[float, float], float, str]:
    boxes = json.loads(boxes_path.read_text())
    if xy is not None:
        return xy, None, f"{xy[0]:.0f},{xy[1]:.0f}"
    by_id = {b["id"]: b for b in boxes}
    b = by_id.get(box_id) if box_id else max(
        boxes, key=lambda b: b["center"][2] + b["extent"][2] / 2)  # tallest = default OP
    cx, cy, cz = b["center"]
    lx, ly, lz = b["extent"]
    top = cz + lz / 2
    # Put the OP at the roof EDGE facing outward (away from the built-up centroid),
    # not the centre — a real observer overlooks the approach, and the centre of a
    # large flat roof occludes its own surrounding ground.
    mx = sum(bb["center"][0] for bb in boxes) / len(boxes)
    my = sum(bb["center"][1] for bb in boxes) / len(boxes)
    dx, dy = cx - mx, cy - my
    d = math.hypot(dx, dy) or 1.0
    reach = 0.48 * max(lx, ly)
    return (cx + dx / d * reach, cy + dy / d * reach), top, b["id"]


def main() -> None:
    ap = argparse.ArgumentParser(description="Compute a viewshed from an observer")
    ap.add_argument("--res", type=float, default=1.0)
    ap.add_argument("--range", type=float, default=1200.0, dest="max_range")
    ap.add_argument("--arc", type=float, default=360.0)
    ap.add_argument("--facing", type=float, default=0.0)
    ap.add_argument("--eye", type=float, default=1.7)
    ap.add_argument("--target", type=float, default=1.7)
    ap.add_argument("--box", type=str, default=None, help="place observer on this box id (rooftop)")
    ap.add_argument("--x", type=float, default=None)
    ap.add_argument("--y", type=float, default=None)
    args = ap.parse_args()

    t = build_dsm(DATA / "point_cloud.ply", args.res, DATA / "bounding_boxes.json")
    xy = (args.x, args.y) if args.x is not None and args.y is not None else None
    obs_xy, obs_top, obs_label = _pick_observer(DATA / "bounding_boxes.json", args.box, xy)
    obs_z = (obs_top + args.eye) if obs_top is not None else None

    vis, (orow, ocol), eye = viewshed(
        t["dsm"], t["transform"], args.res, obs_xy, obs_z=None if obs_z is None else obs_top,
        eye_h=args.eye, target_h=args.target, max_range=args.max_range,
        facing_deg=args.facing, arc_deg=args.arc)
    eye = (obs_top if obs_top is not None else float(t["dsm"][orow, ocol])) + args.eye

    save_geotiff(vis.astype("uint8"), t["transform"], t["epsg"], BUILD / "viewshed.tif", dtype="uint8")

    # sample per web-cloud-point for the viewer overlay. Pack the exact same points
    # the FastAPI viewer serves (same fn + defaults => identical indices, aligned overlay).
    pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
    meta = pack["meta"]
    ox, oy, oz = meta["origin"]
    sx, sy, sz = meta["span"]
    n = meta["n"]
    buf = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
    wx = buf[:, 0] + ox
    wy = buf[:, 1] + oy
    tr = t["transform"]
    cols = ((wx - tr.c) / tr.a).astype(np.int64)
    rows = ((tr.f - wy) / (-tr.e)).astype(np.int64)
    h, w = vis.shape
    ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
    flags = np.zeros(n, dtype=np.uint8)
    flags[ok] = vis[rows[ok], cols[ok]]
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / "viewshed.bin").write_bytes(flags.tobytes())

    obs_eye_world = (obs_xy[0], obs_xy[1], eye)
    info = {
        "observer_label": obs_label,
        "observer_world": [obs_xy[0], obs_xy[1], eye],
        # recentred into the viewer's local frame (east->X, up->Y, north->-Z)
        "observer_view": [(obs_xy[0] - ox) - sx / 2, (eye - oz) - sz / 2, -((obs_xy[1] - oy) - sy / 2)],
        "params": {"range_m": args.max_range, "arc_deg": args.arc, "facing_deg": args.facing,
                   "eye_h": args.eye, "target_h": args.target, "res_m": args.res},
        "pct_points_visible": round(100 * flags.mean(), 1),
        "cells_visible": int(vis.sum()),
    }
    (BUILD / "viewshed.json").write_text(json.dumps(info))

    print(f"observer: {obs_label} @ {obs_eye_world[0]:.0f} E {obs_eye_world[1]:.0f} N, eye {eye:.1f} m")
    print(f"range {args.max_range:.0f} m, arc {args.arc:.0f}°  | visible cells {vis.sum():,} "
          f"| {info['pct_points_visible']}% of cloud points seen")
    print(f"wrote {BUILD/'viewshed.tif'} + {BUILD/'viewshed.bin'} + viewshed.json")


if __name__ == "__main__":
    main()
