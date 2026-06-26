"""Pack the point cloud for the three.js viewer.

Voxel-downsamples the ~4M-point cloud for smooth rendering, recenters to a local
origin (UTM values exceed float32 precision, so the browser must use a local
frame), and writes a compact binary + metadata into the frontend's public dir.
The bounding boxes are copied across unchanged.

    uv run python src/backend/scripts/prepare_web.py [--voxel 0.3] [--max-points 1400000]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from src.backend.io import read_ply  # noqa: E402

DATA = ROOT / "data"
PUBLIC = ROOT / "src" / "frontend" / "public"


def main() -> None:
    ap = argparse.ArgumentParser(description="Pack the point cloud for the web viewer")
    ap.add_argument("--voxel", type=float, default=0.30, help="voxel size (m) for downsampling")
    ap.add_argument("--max-points", type=int, default=1_400_000, help="hard cap on rendered points")
    ap.add_argument("--ply", type=Path, default=DATA / "point_cloud.ply")
    ap.add_argument("--boxes", type=Path, default=DATA / "bounding_boxes.json")
    args = ap.parse_args()

    PUBLIC.mkdir(parents=True, exist_ok=True)
    v = read_ply(args.ply)
    x, y, z = (np.asarray(v[c]) for c in ("x", "y", "z"))
    r, g, b = (np.asarray(v[c]) for c in ("red", "green", "blue"))

    ox, oy, oz = float(x.min()), float(y.min()), float(z.min())

    # one point per occupied voxel -> uniform-looking downsample
    vi = ((x - ox) / args.voxel).astype(np.uint64)
    vj = ((y - oy) / args.voxel).astype(np.uint64)
    vk = ((z - oz) / args.voxel).astype(np.uint64)
    _, sel = np.unique((vi << 42) | (vj << 21) | vk, return_index=True)
    if sel.size > args.max_points:
        sel = np.sort(np.random.default_rng(0).choice(sel, args.max_points, replace=False))

    pos = np.empty((sel.size, 3), np.float32)
    pos[:, 0], pos[:, 1], pos[:, 2] = x[sel] - ox, y[sel] - oy, z[sel] - oz
    col = np.empty((sel.size, 3), np.uint8)
    col[:, 0], col[:, 1], col[:, 2] = r[sel], g[sel], b[sel]

    (PUBLIC / "cloud.bin").write_bytes(pos.tobytes() + col.tobytes())
    meta = {
        "n": int(sel.size),
        "origin": [ox, oy, oz],
        "span": [float(x.max() - ox), float(y.max() - oy), float(z.max() - oz)],
    }
    (PUBLIC / "meta.json").write_text(json.dumps(meta))
    if args.boxes.exists():
        shutil.copy(args.boxes, PUBLIC / "bounding_boxes.json")

    print(f"wrote {sel.size:,} pts (voxel {args.voxel} m, from {v.shape[0]:,}) -> {PUBLIC}")
    print(f"meta: {meta}")


if __name__ == "__main__":
    main()
