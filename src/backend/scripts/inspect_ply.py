"""Print structure and statistics of the point cloud — sanity check the data.

    uv run python src/backend/scripts/inspect_ply.py [path/to/cloud.ply]
"""

from __future__ import annotations

from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from src.backend.io import read_ply  # noqa: E402

DATA = ROOT / "data"


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "point_cloud.ply"
    v = read_ply(path)
    print(f"file:   {path}")
    print(f"fields: {v.dtype.names}")
    print(f"points: {v.shape[0]:,}")

    for ax in ("x", "y", "z"):
        a = np.asarray(v[ax])
        print(f"  {ax}: min {a.min():.3f}  max {a.max():.3f}  span {a.max() - a.min():.3f} m")

    if {"red", "green", "blue"} <= set(v.dtype.names):
        n = v.shape[0]
        idx = np.random.default_rng(0).choice(n, size=min(200_000, n), replace=False)
        r, g, b = (np.asarray(v[c])[idx].astype(np.uint32) for c in ("red", "green", "blue"))
        uniq = np.unique((r << 16) | (g << 8) | b).size
        print(f"  unique colours in {idx.size:,} sample: {uniq:,}  "
              f"({'real RGB texture' if uniq > 1000 else 'looks like class palette'})")

    z = np.asarray(v["z"])
    pct = np.percentile(z, [0, 1, 5, 50, 95, 99, 100]).round(2)
    print(f"  z percentiles [0,1,5,50,95,99,100]: {pct}")


if __name__ == "__main__":
    main()
