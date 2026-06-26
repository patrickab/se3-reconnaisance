"""Rasterize the cloud to 2D analysis layers (ortho / DSM / height-above-ground).

Quick top-down views for understanding the scene and debugging. Output PNGs go to
``docs/figures/`` (gitignored — they are derived imagery of the data).

    uv run python src/backend/scripts/render_rasters.py [--res 0.5]
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from src.backend.io import read_ply  # noqa: E402

DATA = ROOT / "data"
OUT = ROOT / "docs" / "figures"


def main() -> None:
    ap = argparse.ArgumentParser(description="Rasterize the cloud to 2D layers")
    ap.add_argument("--res", type=float, default=0.5, help="metres per pixel")
    ap.add_argument("--ply", type=Path, default=DATA / "point_cloud.ply")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    v = read_ply(args.ply)
    x, y, z = (np.asarray(v[c]) for c in ("x", "y", "z"))
    r, g, b = (np.asarray(v[c]) for c in ("red", "green", "blue"))

    x0, y0 = x.min(), y.min()
    w = int(np.ceil((x.max() - x0) / args.res))
    h = int(np.ceil((y.max() - y0) / args.res))
    ix = np.clip(((x - x0) / args.res).astype(np.int64), 0, w - 1)
    iy = h - 1 - np.clip(((y - y0) / args.res).astype(np.int64), 0, h - 1)  # north up
    cell = iy * w + ix
    order = np.argsort(z, kind="stable")  # last write per cell = highest point

    # top-down ortho (colour of highest point per cell)
    rgb = np.zeros((w * h, 3), np.uint8)
    rgb[cell[order]] = np.stack([r[order], g[order], b[order]], 1)
    Image.fromarray(rgb.reshape(h, w, 3)).save(OUT / "ortho.png")

    # digital surface model (max height per cell)
    dsm = np.full(w * h, np.nan)
    dsm[cell[order]] = z[order]
    _save(dsm.reshape(h, w), "DSM — max height per cell (m ASL)", "terrain", OUT / "dsm.png")

    print(f"wrote ortho.png + dsm.png -> {OUT}  ({w}x{h} px @ {args.res} m)")


def _save(img: np.ndarray, title: str, cmap: str, path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 9))
    im = ax.imshow(img, cmap=cmap)
    ax.set_title(title)
    ax.axis("off")
    fig.colorbar(im, ax=ax, shrink=0.7)
    fig.tight_layout()
    fig.savefig(path, dpi=90)
    plt.close(fig)


if __name__ == "__main__":
    main()
