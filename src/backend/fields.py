"""Threat projection — what the enemy laydown actually covers (fires + observation).

Takes the likely enemy positions (threat_template output) and projects each one's
real threat onto the terrain, then combines them the way a real IPB fires-and-
observation overlay is built. Design choices (per operator review):

1. CONTINUOUS cost, not a red/green mask — the route planner needs a gradient;
   we threshold only for the human display.
2. ENGAGEMENT-AREA DEPTH — observation is a COUNT of how many enemy can see/engage
   a cell, not a union. Depth >= 2 = mutually-supporting kill zone (cross-fire).
5. Two TARGET HEIGHTS — dead ground depends on the target: dismount (1.7 m) finds
   cover a vehicle (2.5 m) does not. We output both.
6. RANGE-GRADUATED lethality (p_hit decays past effective range, not a hard edge)
   and per-asset SECTOR OF FIRE (a hull-down tank covers an arc, not 360deg).
4. Indirect = mortar_range ∩ (observed ∪ pre-planned TRPs on chokepoints) — so an
   attacker can't "game" the map by hugging dead ground through a registered defile.

Honest limit: the DSM treats tree canopy as a solid occluder, so dead ground behind
vegetation is really CONCEALMENT (hides you, doesn't stop a round). Until
landcover.py exists we tag that as lower-confidence, not fully safe.

    uv run python src/backend/fields.py [--side west]

Outputs: build/fields_{cost,depth}.tif + build/{danger,depth}.bin + fields.json
(served by /api/{danger,depth,fields-info}).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
from scipy.ndimage import distance_transform_edt, maximum_filter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.app import MAX_POINTS, VOXEL, pack_cloud  # noqa: E402
from src.backend.terrain import BUILD, DATA, box_polygon, build_dsm, save_geotiff  # noqa: E402
from src.backend.visibility import viewshed  # noqa: E402

# Per-asset profiles (THREAT_LIBRARY). eye_h = sensor height above its footing;
# eff/mx = effective / max range (m); arc = sector of fire (deg, oriented to the AA).
PROFILES = {
    "sniper_op": {"fire": "direct", "eye_h": 1.7, "eff": 800, "mx": 1300, "arc": 200},
    "tank": {"fire": "direct", "eye_h": 2.5, "eff": 1800, "mx": 2500, "arc": 100},
    "mortar": {"fire": "indirect", "mx": 7000},
}
TARGETS = {"dismount": 1.7, "mount": 2.5}  # standing soldier vs vehicle


def p_hit(dist: np.ndarray, eff: float, mx: float) -> np.ndarray:
    """Range-graduated hit probability: ~1 inside effective, fading to ~0.2 at max, 0 beyond."""
    p = np.where(dist <= eff, 1.0, 1.0 - 0.8 * (dist - eff) / max(1.0, mx - eff))
    return np.clip(np.where(dist <= mx, p, 0.0), 0.0, 1.0)


def run(side: str = "west", res: float = 2.0) -> dict:
    """Project the enemy laydown into threat fields — callable from CLI and /recompute."""
    t = build_dsm(DATA / "point_cloud.ply", res, DATA / "bounding_boxes.json")
    dsm, transform, bounds, (h, w) = t["dsm"], t["transform"], t["bounds"], t["shape"]
    threat = json.loads((BUILD / "threat.json").read_text())
    enemies = threat["positions"]
    # same avenue the laydown was templated against (operator-placed or auto)
    aa_cx, aa_cy = threat["avenue_centroid"]

    # coordinate grids (cell centres, UTM) for range / distance maths
    cols, rows = np.meshgrid(np.arange(w), np.arange(h))
    gx = transform.c + (cols + 0.5) * transform.a
    gy = transform.f - (rows + 0.5) * (-transform.e)

    depth = {k: np.zeros((h, w), np.int16) for k in TARGETS}      # engagement-area depth
    direct = {k: np.zeros((h, w), np.float32) for k in TARGETS}   # P(hit) union, range-graded
    n_direct = 0
    for e in enemies:
        prof = PROFILES[e["type"]]
        if prof["fire"] != "direct":
            continue
        n_direct += 1
        E, N, U = e["world"]
        facing = np.degrees(np.arctan2(aa_cy - N, aa_cx - E))
        dist = np.hypot(gx - E, gy - N)
        pr = p_hit(dist, prof["eff"], prof["mx"])
        for k, th in TARGETS.items():
            vis, _, _ = viewshed(dsm, transform, res, (E, N), obs_z=U,
                                 eye_h=prof["eye_h"], target_h=th, max_range=prof["mx"],
                                 facing_deg=float(facing), arc_deg=prof["arc"])
            depth[k] += vis                                       # +1 per shooter that sees it
            direct[k] = 1.0 - (1.0 - direct[k]) * (1.0 - vis * pr)  # probabilistic union

    # ---- pre-planned TRPs on terrain-forced chokepoints (point 4) ----
    box_mask = np.zeros((h, w), bool)
    from rasterio.features import rasterize
    box_mask = rasterize([(box_polygon(b), 1) for b in json.loads((DATA / "bounding_boxes.json").read_text())],
                         out_shape=(h, w), transform=transform, fill=0, dtype="uint8").astype(bool)
    passable = (~box_mask) & t["valid"]
    clearance = distance_transform_edt(passable) * res       # corridor half-width (m)
    ridge = (clearance == maximum_filter(clearance, size=3)) & passable   # medial axis
    choke = ridge & (clearance > 1.5) & (clearance < 7)           # narrow passages on the route net
    trp = np.zeros((h, w), bool)
    cr, cc = np.where(choke)
    chosen, trps = [], []
    for i in np.argsort(clearance[cr, cc]):                       # narrowest first
        r, c = int(cr[i]), int(cc[i])
        if any((r - sr) ** 2 + (c - sc) ** 2 < (60 / res) ** 2 for sr, sc in chosen):
            continue
        chosen.append((r, c))
        trps.append([round(transform.c + (c + 0.5) * transform.a, 1),
                     round(transform.f - (r + 0.5) * (-transform.e), 1)])
        trp[max(0, r - 2):r + 3, max(0, c - 2):c + 3] = True      # TRP beaten zone
        if len(trps) >= 4:
            break

    # ---- indirect: in mortar range AND (observed by any eyes OR pre-registered) ----
    in_range = np.zeros((h, w), bool)
    for e in enemies:
        if PROFILES[e["type"]]["fire"] != "indirect":
            continue
        E, N, _ = e["world"]
        in_range |= np.hypot(gx - E, gy - N) <= PROFILES[e["type"]]["mx"]
    observed = depth["dismount"] > 0
    indirect = in_range.astype(np.float32) * np.clip(0.6 * observed + 0.7 * trp, 0.0, 0.9)

    # ---- cover (boxes stop rounds) reduces risk; combine to a continuous cost ----
    cover_near = np.clip(1.0 - distance_transform_edt(~box_mask) * res / 8.0, 0.0, 1.0)
    for k in TARGETS:
        d = direct[k]
        emphasis = 1.0 + 0.35 * np.clip(depth[k] - 1, 0, None)    # kill zones (overlap) hurt more
        cost = (d + 0.5 * indirect) * emphasis - 0.3 * cover_near
        cost = np.clip(np.where(t["valid"] | box_mask, cost, 0.0), 0.0, 1.0)
        save_geotiff(cost, transform, t["epsg"], BUILD / f"fields_cost_{k}.tif")
        if k == "dismount":
            cost_dismount = cost
    save_geotiff(depth["dismount"].astype("float32"), transform, t["epsg"], BUILD / "fields_depth.tif")

    # ---- per-web-point overlays for the viewer ----
    pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
    meta = pack["meta"]
    ox, oy = meta["origin"][0], meta["origin"][1]
    n = meta["n"]
    pts = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
    pc = ((pts[:, 0] + ox - transform.c) / transform.a).astype(np.int64)
    prow = ((transform.f - (pts[:, 1] + oy)) / (-transform.e)).astype(np.int64)
    ok = (pc >= 0) & (pc < w) & (prow >= 0) & (prow < h)

    danger_b = np.zeros(n, np.uint8)
    danger_b[ok] = (cost_dismount[prow[ok], pc[ok]] * 255).astype(np.uint8)
    depth_b = np.zeros(n, np.uint8)
    depth_b[ok] = np.clip(depth["dismount"][prow[ok], pc[ok]], 0, 255).astype(np.uint8)
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / "danger.bin").write_bytes(danger_b.tobytes())
    (BUILD / "depth.bin").write_bytes(depth_b.tobytes())

    info = {
        "side": side,
        "n_direct_shooters": n_direct,
        "max_engagement_depth": int(depth["dismount"].max()),
        "trps": trps,
        "pct_in_kill_zone": round(100 * float((depth["dismount"] >= 2).sum() / max(1, t["valid"].sum())), 1),
        "note": "depth = overlapping fields of fire (>=2 = mutually-supporting kill zone). "
                "Concealment from vegetation not yet modelled (pending landcover.py).",
    }
    (BUILD / "fields.json").write_text(json.dumps(info))

    print(f"{n_direct} direct shooters projected | max engagement depth {info['max_engagement_depth']} "
          f"| {info['pct_in_kill_zone']}% of ground in a >=2 kill zone | {len(trps)} TRPs on chokepoints")
    print(f"wrote build/fields_cost_*.tif + fields_depth.tif + danger.bin + depth.bin + fields.json")
    return info


def main() -> None:
    ap = argparse.ArgumentParser(description="Project the enemy laydown into threat fields")
    ap.add_argument("--side", default="west", choices=["west", "east", "north", "south"])
    ap.add_argument("--res", type=float, default=2.0)
    a = ap.parse_args()
    run(a.side, a.res)


if __name__ == "__main__":
    main()
