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

from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np
from pydantic import BaseModel, Field

from src.backend.io import read_ply
from src.backend.terrain import build_dsm
from src.backend.units import PlaceUnitRequest, UpdateUnitRequest, UnitContact, resolve_unit, unit_profiles
from src.backend.visibility import viewshed

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from affine import Affine

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
BUILD = ROOT / "build"          # viewshed.{bin,json} land here (gitignored)

CONFIG = json.loads((ROOT / "src" / "config.json").read_text())  # shared with frontend
VOXEL = CONFIG["cloud"]["voxel_m"]          # metres per voxel
MAX_POINTS = CONFIG["cloud"]["max_points"]  # cap on served points

PACK: dict = {}  # {"bin": bytes, "meta": {...}} filled on startup
TERRAIN: dict[float, dict] = {}
UNITS: dict[str, UnitContact] = {}  # in-memory contact store; resets on server restart


class ViewshedRequest(BaseModel):
    x: float
    y: float
    z: float | None = None
    range_m: float = Field(1200.0, gt=0)
    arc_deg: float = Field(360.0, gt=0, le=360)
    facing_deg: float = 0.0
    eye_h: float = 1.7
    target_h: float = 1.7
    res_m: float = Field(1.0, gt=0)


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
    # Source X/Y sit on a perfect 1/16 m DSM lattice, which renders as moiré
    # "corduroy" lines. Sub-voxel horizontal jitter breaks the grid; no point
    # moves more than half a voxel, and z (true elevation) is left untouched.
    pos[:, :2] += np.random.default_rng(1).uniform(-voxel / 2, voxel / 2, (sel.size, 2)).astype(np.float32)
    col = np.empty((sel.size, 3), np.uint8)
    col[:, 0], col[:, 1], col[:, 2] = r[sel], g[sel], b[sel]

    return {
        "bin": pos.tobytes() + col.tobytes(),
        "meta": {"n": int(sel.size), "origin": [ox, oy, oz],
                 "span": [float(x.max() - ox), float(y.max() - oy), float(z.max() - oz)]},
    }


def terrain_for(res_m: float) -> dict:
    if res_m not in TERRAIN:
        TERRAIN[res_m] = build_dsm(DATA / "point_cloud.ply", res_m, DATA / "bounding_boxes.json")
    return TERRAIN[res_m]


def flags_for_viewshed(vis: np.ndarray, transform: Affine) -> np.ndarray:
    meta = PACK["meta"]
    n = meta["n"]
    ox, oy, _ = meta["origin"]
    buf = np.frombuffer(PACK["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
    wx = buf[:, 0] + ox
    wy = buf[:, 1] + oy
    cols = ((wx - transform.c) / transform.a).astype(np.int64)
    rows = ((transform.f - wy) / (-transform.e)).astype(np.int64)
    h, w = vis.shape
    ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
    flags = np.zeros(n, dtype=np.uint8)
    flags[ok] = vis[rows[ok], cols[ok]]
    return flags


def clear_laydown() -> None:
    """Wipe the operator's enemy laydown and everything projected from it.

    The laydown is per-session intel, never carried over: the battlefield must
    open blank (terrain + object boxes only) until the operator places the enemy
    and analyses. Terrain artifacts (DSM, viewshed) are independent and kept.
    """
    for f in (*BUILD.glob("danger_*.bin"), *BUILD.glob("pfatal_*.bin"), *BUILD.glob("depth_*.bin"),
              *BUILD.glob("reason_*.bin"), *BUILD.glob("conf_*.bin"), *BUILD.glob("suppress_*.bin")):
        f.unlink(missing_ok=True)
    for name in ("threat.json", "threat.bin", "danger.bin", "depth.bin", "reason.bin", "conf.bin", "fields.json"):
        (BUILD / name).unlink(missing_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    clear_laydown()  # start every session with an empty battlefield
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
    expose_headers=["x-viewshed-info"],
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


@app.post("/api/viewshed")
def viewshed_at_cursor(req: ViewshedRequest) -> Response:
    terrain = terrain_for(req.res_m)
    vis, (orow, ocol), eye = viewshed(
        terrain["dsm"],
        terrain["transform"],
        req.res_m,
        (req.x, req.y),
        obs_z=req.z,
        eye_h=req.eye_h,
        target_h=req.target_h,
        max_range=req.range_m,
        facing_deg=req.facing_deg,
        arc_deg=req.arc_deg,
    )
    flags = flags_for_viewshed(vis, terrain["transform"])
    info = {
        "observer_label": f"cursor {req.x:.0f},{req.y:.0f}",
        "observer_world": [req.x, req.y, eye],
        "params": {
            "range_m": req.range_m,
            "arc_deg": req.arc_deg,
            "facing_deg": req.facing_deg,
            "eye_h": req.eye_h,
            "target_h": req.target_h,
            "res_m": req.res_m,
        },
        "pct_points_visible": round(100 * float(flags.mean()), 1),
        "cells_visible": int(vis.sum()),
        "cell": [orow, ocol],
    }
    return Response(
        flags.tobytes(),
        media_type="application/octet-stream",
        headers={"x-viewshed-info": json.dumps(info, separators=(",", ":"))},
    )


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


def _bin(name: str) -> Response:
    f = BUILD / name
    if not f.exists():
        return Response(status_code=404)
    return Response(f.read_bytes(), media_type="application/octet-stream")


# risk surfaces are projected per TARGET CLASS; ?class= picks who's moving (default dismount)
_RISK_CLASSES = {"dismount", "light_veh", "armour"}


def _class_bin(kind: str, cls: str) -> Response:
    c = cls if cls in _RISK_CLASSES else "dismount"
    return _bin(f"{kind}_{c}.bin")


@app.get("/api/danger")
def danger(cls: str = Query("dismount", alias="class")) -> Response:
    return _class_bin("danger", cls)


@app.get("/api/pfatal")
def pfatal(cls: str = Query("dismount", alias="class")) -> Response:  # P(fatal enemy fire), 0-255
    return _class_bin("pfatal", cls)


@app.get("/api/depth")
def depth(cls: str = Query("dismount", alias="class")) -> Response:
    return _class_bin("depth", cls)


@app.get("/api/reason")
def reason(cls: str = Query("dismount", alias="class")) -> Response:  # 0 out-of-range 1 dead-ground 2 cover 3 exposed
    return _class_bin("reason", cls)


@app.get("/api/conf")
def conf(cls: str = Query("dismount", alias="class")) -> Response:    # intel-confidence the cell is threatened
    return _class_bin("conf", cls)


@app.get("/api/suppress")
def suppress(cls: str = Query("dismount", alias="class")) -> Response:  # suppression (beaten zone) field
    return _class_bin("suppress", cls)


@app.get("/api/fields-info")
def fields_info() -> Response:
    f = BUILD / "fields.json"
    if not f.exists():
        return Response(status_code=404)
    return FileResponse(f, media_type="application/json")


# ---- unit contact store -------------------------------------------------------

@app.get("/api/units")
def list_units(side: str | None = None) -> list[UnitContact]:
    units = list(UNITS.values())
    if side:
        units = [u for u in units if u.side.value == side]
    return units


@app.get("/api/unit-profiles")
def unit_profiles_endpoint() -> list[dict]:
    """Doctrinal catalog as lightweight profile dicts — the frontend's single
    source of truth for per-type range/arc/label (drag-preview rings, popups).
    No placement state; pure type definitions."""
    return unit_profiles()


@app.post("/api/units")
def place_unit(req: PlaceUnitRequest) -> UnitContact:
    # unit_type is a pydantic-validated UnitType enum, so the catalog lookup always hits.
    contact = resolve_unit(req.unit_type.value).new_contact(req)
    UNITS[contact.id] = contact
    return contact


@app.patch("/api/units/{unit_id}")
def update_unit(unit_id: str, req: UpdateUnitRequest) -> UnitContact:
    contact = UNITS.get(unit_id)
    if not contact:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="unit not found")
    data = req.model_dump(exclude_none=True)
    UNITS[unit_id] = contact.model_copy(update=data)
    return UNITS[unit_id]


@app.delete("/api/units/{unit_id}")
def delete_unit(unit_id: str) -> dict:
    UNITS.pop(unit_id, None)
    return {"ok": True}


@app.delete("/api/units")
def clear_units(side: str | None = None) -> dict:
    if side:
        to_remove = [k for k, v in UNITS.items() if v.side.value == side]
        for k in to_remove:
            del UNITS[k]
    else:
        UNITS.clear()
    return {"ok": True}


# ---- threat recompute ---------------------------------------------------------

class PlacedEnemy(BaseModel):
    e: float
    n: float
    u: float
    type: str = "sniper_op"  # sniper_op | tank | mortar (legacy; new flow uses /api/units)


class RecomputeReq(BaseModel):
    enemies: list[PlacedEnemy] | None = None   # explicit override; omit to use /api/units store
    friendly: list[list[float]] | None = None


@app.post("/api/threat/recompute")
def recompute(req: RecomputeReq | None = None) -> dict:
    """Build the enemy laydown from operator-placed positions, then project the
    fires/observation fields (kill zones, danger). Reads from the /api/units store
    unless an explicit payload overrides it. Returns counts for the UI."""
    from src.backend import fields, threat_template  # noqa: PLC0415

    # resolve enemies: explicit body > UNITS store
    if req and req.enemies is not None:
        enemies = [e.model_dump() for e in req.enemies]
    else:
        enemies = [
            {"e": u.world[0], "n": u.world[1], "u": u.world[2],
             # sniper_op is the legacy key threat_template expects; map sniper → sniper_op
             "type": "sniper_op" if u.unit_type.value == "sniper" else u.unit_type.value,
             # operator-set heading — orients the sector of fire / kill zone (not the avenue)
             "azimuth": u.azimuth,
             # intel quality — modulates risk-zone confidence in the projection
             "confidence": u.confidence}
            for u in UNITS.values() if u.side.value == "hostile"
        ]

    if req and req.friendly is not None:
        friendly_pts: list[tuple[float, float, float]] | None = [
            (float(p[0]), float(p[1]), float(p[2])) for p in req.friendly
        ] or None
    else:
        friendly_pts = [
            (u.world[0], u.world[1], u.world[2])
            for u in UNITS.values() if u.side.value == "friendly"
        ] or None

    threat_template.from_manual(enemies, friendly_pts)
    fields.run()
    n_friendly = len(friendly_pts) if friendly_pts else 0
    return {"ok": True, "n_enemies": len(enemies), "n_friendly": n_friendly}


@app.post("/api/threat/reset")
def reset() -> dict:
    """Clear the laydown so the battlefield goes blank again (operator clear)."""
    clear_laydown()
    return {"ok": True}
