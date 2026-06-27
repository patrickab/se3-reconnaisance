"""FastAPI backend: pack the point cloud once on startup, serve it as an API.

    uv run uvicorn src.backend.app:app --port 8011      (or ./run.sh)

The UI is served separately by Vite (src/frontend). Endpoints:
  /api/meta · /api/cloud (binary) · /api/boxes
  /api/viewshed (binary) · /api/viewshed-info  — present only after
  `uv run python src/backend/visibility.py` writes them to build/.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import json
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np

from src.backend.io import read_ply

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
BUILD = ROOT / "build"          # viewshed.{bin,json} land here (gitignored)

CONFIG = json.loads((ROOT / "src" / "config.json").read_text())  # shared with frontend
VOXEL = CONFIG["cloud"]["voxel_m"]          # metres per voxel
MAX_POINTS = CONFIG["cloud"]["max_points"]  # cap on served points

PACK: dict = {}  # {"bin": bytes, "meta": {...}} filled on startup


def pack_cloud(ply: Path, voxel: float, max_points: int) -> dict:
    """Voxel-downsample to one point per occupied cell, recenter to a local origin.

    UTM doubles exceed float32 precision, so positions are stored relative to the
    min corner; the viewer works in metres from that origin. Layout of "bin":
    N float32 positions (xyz) followed by N uint8 colours (rgb).
    """
    v = read_ply(ply)
    x, y, z = (np.asarray(v[c]) for c in ("x", "y", "z"))
    r, g, b = (np.asarray(v[c]) for c in ("red", "green", "blue"))
    ox, oy, oz = float(x.min()), float(y.min()), float(z.min())

    vi = ((x - ox) / voxel).astype(np.uint64)
    vj = ((y - oy) / voxel).astype(np.uint64)
    vk = ((z - oz) / voxel).astype(np.uint64)
    _, sel = np.unique((vi << 42) | (vj << 21) | vk, return_index=True)  # one per voxel
    if sel.size > max_points:
        sel = np.sort(np.random.default_rng(0).choice(sel, max_points, replace=False))

    pos = np.empty((sel.size, 3), np.float32)
    pos[:, 0], pos[:, 1], pos[:, 2] = x[sel] - ox, y[sel] - oy, z[sel] - oz
    col = np.empty((sel.size, 3), np.uint8)
    col[:, 0], col[:, 1], col[:, 2] = r[sel], g[sel], b[sel]

    return {
        "bin": pos.tobytes() + col.tobytes(),
        "meta": {"n": int(sel.size), "origin": [ox, oy, oz],
                 "span": [float(x.max() - ox), float(y.max() - oy), float(z.max() - oz)]},
    }


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    PACK.update(pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS))
    print(f"packed {PACK['meta']['n']:,} pts @ {VOXEL} m/voxel")
    yield


app = FastAPI(lifespan=lifespan)

# Dev convenience: allow the Vite dev server to hit the API directly too.
_fe = CONFIG["frontend"]["port"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{_fe}", f"http://127.0.0.1:{_fe}"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/meta")
def meta() -> dict:
    return PACK["meta"]


@app.get("/api/cloud")
def cloud() -> Response:
    return Response(PACK["bin"], media_type="application/octet-stream")


@app.get("/api/boxes")
def boxes() -> FileResponse:
    return FileResponse(DATA / "bounding_boxes.json", media_type="application/json")


@app.get("/api/viewshed")
def viewshed_bin() -> Response:
    f = BUILD / "viewshed.bin"
    if not f.exists():
        return Response(status_code=404)
    return Response(f.read_bytes(), media_type="application/octet-stream")


@app.get("/api/viewshed-info")
def viewshed_info() -> Response:
    f = BUILD / "viewshed.json"
    if not f.exists():
        return Response(status_code=404)
    return FileResponse(f, media_type="application/json")


@app.get("/api/threat")
def threat_bin() -> Response:
    f = BUILD / "threat.bin"
    if not f.exists():
        return Response(status_code=404)
    return Response(f.read_bytes(), media_type="application/octet-stream")


@app.get("/api/threat-info")
def threat_info() -> Response:
    f = BUILD / "threat.json"
    if not f.exists():
        return Response(status_code=404)
    return FileResponse(f, media_type="application/json")
