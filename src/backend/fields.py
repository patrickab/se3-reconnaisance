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
4. Indirect = mortar_range AND (observed OR pre-planned TRPs on chokepoints) — so an
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
from typing import TYPE_CHECKING

import numpy as np
from scipy.ndimage import distance_transform_edt, maximum_filter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.app import CONFIG, MAX_POINTS, PACK, VOXEL, pack_cloud, terrain_for  # noqa: E402
from src.backend.terrain import BUILD, DATA, box_polygon, save_geotiff  # noqa: E402
from src.backend.units import TARGET_HEIGHT_M, resolve_unit  # noqa: E402
from src.backend.visibility import viewshed  # noqa: E402

if TYPE_CHECKING:
    from affine import Affine

# target classes (units.TARGET_HEIGHT_M): dismount 1.7 m · light_veh 2.5 m · armour 2.5 m.
# light_veh + armour share a LOS height, so the viewshed is still only ever traced at two heights.
CLASSES = list(TARGET_HEIGHT_M)
HEIGHTS = sorted(set(TARGET_HEIGHT_M.values()))
KILL_EPS = 0.05   # a cell counts toward a class's engagement depth once P(kill) clears this
# ponytail: one global exposure multiplier — shots a target absorbs while crossing an exposed cell;
# turns single-shot SSKP into cumulative P(kill) = 1-(1-p)^n. =1 → single shot (no change).
# Per-weapon rate-of-fire (catalog field) if absolute calibration ever matters; relative map holds either way.
EXPOSURE_SHOTS = float(CONFIG.get("fires", {}).get("exposure_shots", 1))


def _profile(typ: str) -> dict:
    """Reshape a units.UNIT_CATALOG entry into the projection dict the loop reads."""
    u = resolve_unit(typ)
    if u is None:
        raise KeyError(f"unknown enemy type in threat laydown: {typ!r}")
    return {
        "fire": u.fire_kind.value, "eye_h": u.height_agl_m,
        "eff": u.eff_range_m, "mx": u.max_range_m, "mn": u.min_range_m,
        "obs_arc": u.obs_arc, "weapon_arc": u.weapon_arc,
        "p0": u.ph_p0, "d50": max(1.0, u.ph_shoulder * u.eff_range_m), "beta": u.ph_beta,
        "s0": u.supp_s0, "kill": u.eff,   # P(kill|hit) per target class
    }


def p_hit(dist: np.ndarray, p0: float, d50: float, beta: float, mn: float, mx: float) -> np.ndarray:
    """Per-weapon single-shot P(hit) vs a point target: Hill plateau p0, knee at d50, steepness
    beta (high = accurate-far-then-cliff, low = far-but-inaccurate). Zero outside [mn, mx]."""
    p = p0 / (1.0 + (dist / d50) ** beta)
    inside = (dist >= mn) & (dist <= mx)
    return np.clip(np.where(inside, p, 0.0), 0.0, 1.0).astype(np.float32)


def p_supp(dist: np.ndarray, s0: float, mx: float) -> np.ndarray | None:
    """Area suppression: a wide, low beaten-zone field (MGs / autofire). None for precision weapons."""
    if s0 <= 0.0:
        return None
    s = s0 / (1.0 + (dist / (1.05 * mx)) ** 3)
    return np.clip(np.where(dist <= 1.1 * mx, s, 0.0), 0.0, 1.0).astype(np.float32)


def _arc_mask(gx: np.ndarray, gy: np.ndarray, e: float, n: float, facing_deg: float, arc_deg: float) -> np.ndarray:
    """Cells within ±arc/2 of facing (viewshed math-angle frame). arc>=360 → all True."""
    if arc_deg >= 360:
        return np.ones(gx.shape, dtype=bool)
    az = np.degrees(np.arctan2(gy - n, gx - e))
    return np.abs((az - facing_deg + 180.0) % 360.0 - 180.0) <= arc_deg / 2.0


# Per-shooter viewshed cache. A shooter's line-of-sight depends only on its own
# (position, facing, type) and the fixed DSM at this resolution — so we key on
# exactly that and reuse the grid across recomputes. Editing one unit then
# re-sweeps one unit, not the whole laydown. Content-keyed: a moved/reoriented
# unit yields a new key and misses; old entries are inert, never stale.
_VIS_CACHE: dict[tuple, np.ndarray] = {}
_VIS_CAP = 512  # ~0.25 MB/grid; flushed wholesale past the cap (no LRU until churn proves it needed)


def _shooter_vis(dsm: np.ndarray, transform: Affine, res: float, e: dict, prof: dict,
                 target_h: float) -> np.ndarray:
    """Observation viewshed for one shooter at one target height — traced at the wide obs arc and
    memoised on its content key (position, heading, type, height) so editing one unit re-sweeps one."""
    E, N, U = e["world"]
    key = (round(E, 1), round(N, 1), round(U, 1), e["facing_deg"], e["type"], round(target_h, 1), res)
    vis = _VIS_CACHE.get(key)
    if vis is None:
        if len(_VIS_CACHE) >= _VIS_CAP:
            _VIS_CACHE.clear()
        vis, _, _ = viewshed(dsm, transform, res, (E, N), obs_z=U, eye_h=prof["eye_h"],
                             target_h=target_h, max_range=prof["mx"], facing_deg=float(e["facing_deg"]),
                             arc_deg=prof["obs_arc"])
        _VIS_CACHE[key] = vis
    return vis


def run(side: str = "west", res: float = 2.0) -> dict:
    """Project the enemy laydown into threat fields — callable from CLI and /recompute."""
    t = terrain_for(res)  # reuse the API's DSM cache (build_dsm under the hood); free when already warm
    dsm, transform, (h, w) = t["dsm"], t["transform"], t["shape"]
    threat = json.loads((BUILD / "threat.json").read_text())
    enemies = threat["positions"]

    # coordinate grids (cell centres, UTM) for range / distance maths
    cols, rows = np.meshgrid(np.arange(w), np.arange(h))
    gx = transform.c + (cols + 0.5) * transform.a
    gy = transform.f - (rows + 0.5) * (-transform.e)

    # per TARGET-CLASS accumulators. P(kill) = P(hit) × P(kill|hit): vis×p_hit is P(hit); the
    # eff[class] factor is P(kill|hit). A weapon with eff[class]==0 (a rifle vs armour) drops out.
    depth = {c: np.zeros((h, w), np.int16) for c in CLASSES}      # engagement-area depth per class
    direct = {c: np.zeros((h, w), np.float32) for c in CLASSES}   # P(kill) union per class
    suppress = {c: np.zeros((h, w), np.float32) for c in CLASSES}  # suppression (beaten zone) per class
    reach = {c: np.zeros((h, w), bool) for c in CLASSES}          # a class-killing weapon can RANGE the cell
    conf = {c: np.zeros((h, w), np.float32) for c in CLASSES}     # intel-confidence the cell is threatened
    observed = np.zeros((h, w), bool)     # union of all eyes (observation arc) — the indirect-fire cue
    n_direct = 0
    for e in enemies:
        prof = _profile(e["type"])
        if prof["fire"] != "direct":
            continue
        n_direct += 1
        E, N, U = e["world"]
        facing = float(e["facing_deg"])   # operator-set heading (= weapon PDF), viewshed math angle
        ec = float(e.get("confidence", 1.0))
        dist = np.hypot(gx - E, gy - N)
        band = (dist >= prof["mn"]) & (dist <= prof["mx"])               # weapon range annulus
        wmask = _arc_mask(gx, gy, E, N, facing, prof["weapon_arc"])      # LETHAL sector of fire
        pr = p_hit(dist, prof["p0"], prof["d50"], prof["beta"], prof["mn"], prof["mx"])
        sup = p_supp(dist, prof["s0"], prof["mx"])
        # one viewshed per LOS height, traced at the wide OBSERVATION arc (memoised per shooter —
        # editing one unit re-sweeps one unit); the lethal layer masks it to the weapon sector
        # (LOS is arc-independent → no extra ray casts vs the old single-arc model).
        vis_by_h = {th: _shooter_vis(dsm, transform, res, e, prof, th) for th in HEIGHTS}
        observed |= vis_by_h[TARGET_HEIGHT_M["dismount"]]               # detection (eyes), full obs arc
        for c in CLASSES:
            kc = float(prof["kill"].get(c, 0.0))
            if kc <= 0.0:
                continue                                                # this weapon can't kill class c
            vis_w = vis_by_h[TARGET_HEIGHT_M[c]] & wmask & band         # weapon-sector lethal LOS
            kill = vis_w * pr * kc                                      # single-shot P(kill | shooter present)
            kcum = 1.0 - (1.0 - kill * ec) ** EXPOSURE_SHOTS           # exposure window × P(enemy actually here)
            direct[c] = 1.0 - (1.0 - direct[c]) * (1.0 - kcum)         # probabilistic union over shooters
            depth[c] += (kill > KILL_EPS)                              # structural count of weapons (pre-confidence)
            reach[c] |= band
            conf[c] = np.maximum(conf[c], vis_w * ec)
            if sup is not None:
                suppress[c] = 1.0 - (1.0 - suppress[c]) * (1.0 - vis_w * sup * kc)

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

    # ---- indirect: range ANNULUS (min-range dead zone → max) AND (observed by any eyes OR a
    #      pre-registered TRP). `observed` is the union of every unit's observation arc (above). ----
    in_range = np.zeros((h, w), bool)
    ind_kill = {c: np.zeros((h, w), np.float32) for c in CLASSES}   # per-cell P(kill|hit) × presence confidence
    for e in enemies:
        prof = _profile(e["type"])
        if prof["fire"] != "indirect":
            continue
        E, N, _ = e["world"]
        ec = float(e.get("confidence", 1.0))
        d = np.hypot(gx - E, gy - N)
        ann = (d >= prof["mn"]) & (d <= prof["mx"])
        in_range |= ann
        for c in CLASSES:
            kc = float(prof["kill"].get(c, 0.0))
            if kc > 0.0:
                reach[c] |= ann
                ind_kill[c] = np.maximum(ind_kill[c], ann * kc * ec)   # gated to this tube's annulus
    indirect = in_range.astype(np.float32) * np.clip(0.6 * observed + 0.7 * trp, 0.0, 0.9)

    # ---- cover (boxes stop rounds) reduces risk; combine into one continuous cost PER CLASS ----
    cover_near = np.clip(1.0 - distance_transform_edt(~box_mask) * res / 8.0, 0.0, 1.0)
    valid = t["valid"]
    costs, reasons, pfatal = {}, {}, {}
    for c in CLASSES:
        emphasis = 1.0 + 0.35 * np.clip(depth[c] - 1, 0, None)            # kill zones (overlap) hurt more
        cost = (direct[c] + 0.5 * indirect * ind_kill[c]) * emphasis - 0.3 * cover_near
        costs[c] = np.clip(np.where(valid | box_mask, cost, 0.0), 0.0, 1.0)
        save_geotiff(costs[c], transform, t["epsg"], BUILD / f"fields_cost_{c}.tif")
        # P(fatal enemy fire): independent-union of direct + indirect lethal hits. A valid marginal
        # probability — every term carries P(kill|hit) AND P(enemy actually placed here) (the `ec`
        # weighting above), unlike `cost`, which credits cover and emphasises kill zones for routing.
        p_ind = np.clip(indirect * ind_kill[c], 0.0, 1.0)
        pf = 1.0 - (1.0 - direct[c]) * (1.0 - p_ind)
        pfatal[c] = np.where(valid | box_mask, pf, 0.0).astype(np.float32)
        assert pfatal[c].min() >= 0.0 and pfatal[c].max() <= 1.0, "pfatal escaped [0,1]"
        # WHY a cell is (un)safe — "not seen" != "safe": canopy is concealment, only a box stops a
        # round. (0 out-of-range, 1 dead-ground, 2 cover, 3 exposed)
        seen = depth[c] > 0
        near_cover = cover_near > 0.5
        reasons[c] = np.where(seen, 3, np.where(near_cover, 2, np.where(reach[c], 1, 0))).astype(np.uint8)
    save_geotiff(depth["dismount"].astype("float32"), transform, t["epsg"], BUILD / "fields_depth.tif")

    # ---- per-web-point overlays for the viewer ----
    # reuse the cloud the API already holds in RAM; only re-pack when run standalone (CLI, no lifespan)
    pack = PACK if PACK.get("meta") else pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
    meta = pack["meta"]
    ox, oy = meta["origin"][0], meta["origin"][1]
    n = meta["n"]
    pts = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
    pc = ((pts[:, 0] + ox - transform.c) / transform.a).astype(np.int64)
    prow = ((transform.f - (pts[:, 1] + oy)) / (-transform.e)).astype(np.int64)
    ok = (pc >= 0) & (pc < w) & (prow >= 0) & (prow < h)
    BUILD.mkdir(parents=True, exist_ok=True)

    def _sample(arr: np.ndarray, scale: float = 1.0) -> bytes:
        b = np.zeros(n, np.uint8)
        b[ok] = np.clip(arr[prow[ok], pc[ok]] * scale, 0, 255).astype(np.uint8)
        return b.tobytes()

    # one set per target class — the "show risk to" toggle picks which (default = dismount)
    for c in CLASSES:
        (BUILD / f"danger_{c}.bin").write_bytes(_sample(costs[c], 255))
        (BUILD / f"pfatal_{c}.bin").write_bytes(_sample(pfatal[c], 255))
        (BUILD / f"depth_{c}.bin").write_bytes(_sample(depth[c].astype(np.float32)))
        (BUILD / f"reason_{c}.bin").write_bytes(_sample(reasons[c].astype(np.float32)))
        (BUILD / f"conf_{c}.bin").write_bytes(_sample(conf[c], 255))
        (BUILD / f"suppress_{c}.bin").write_bytes(_sample(suppress[c], 255))

    nv = max(1, int(valid.sum()))
    def _pct(mask: np.ndarray) -> float:
        return round(100 * float((mask & valid).sum()) / nv, 1)

    def _class_stats(c: str) -> dict:
        rc = reasons[c]
        return {
            "max_engagement_depth": int(depth[c].max()),
            "pct_in_kill_zone": _pct(depth[c] >= 2),
            "exposure": {
                "pct_exposed": _pct(rc == 3), "pct_cover": _pct(rc == 2),
                "pct_dead_ground": _pct(rc == 1), "pct_out_of_range": _pct(rc == 0),
            },
        }

    dismount = _class_stats("dismount")

    # ---- per-soldier exposure: classify each placed friendly (the laydown's avenue points) into a
    #      risk zone on the dismount surface, so the UI can warn "this soldier is in danger" the
    #      instant a newly-spotted enemy puts them at risk (bands match riskBand() in the frontend) ----
    cost_d, depth_d, reason_d = costs["dismount"], depth["dismount"], reasons["dismount"]

    def _zone(d: int, k: int) -> str:
        if k >= 2 or d >= 204:    # mutually-supporting fire / near-certain hit
            return "kill_zone"
        if d >= 128:              # p_hit >= 0.5
            return "high"
        if d >= 51 or k >= 1:     # p_hit >= 0.2, or seen at all
            return "moderate"
        return "low"

    soldiers = []
    for fp in threat.get("avenue", []):
        e_m, n_m = float(fp[0]), float(fp[1])
        col = int((e_m - transform.c) / transform.a)               # floor — matches the per-point sampling
        row = int((transform.f - n_m) / (-transform.e))
        if not (0 <= row < h and 0 <= col < w):
            continue
        # worst case in a small window around the soldier (a soldier isn't a point, and it makes the
        # warning conservative + robust to single-cell gaps in a sparse exposed surface)
        r0, r1, c0, c1 = max(0, row - 1), min(h, row + 2), max(0, col - 1), min(w, col + 2)
        dval = int(round(float(cost_d[r0:r1, c0:c1].max()) * 255))
        kval = int(depth_d[r0:r1, c0:c1].max())
        soldiers.append({
            "world": [round(e_m, 1), round(n_m, 1), round(float(fp[2]) if len(fp) > 2 else 0.0, 1)],
            "zone": _zone(dval, kval), "danger": dval, "depth": kval,
            "exposed": bool((reason_d[r0:r1, c0:c1] == 3).any()),
        })

    info = {
        "side": side,
        "n_direct_shooters": n_direct,
        "classes": CLASSES,
        "trps": trps,
        "soldiers": soldiers,   # placed friendlies + their current risk zone (drives the danger banner)
        # top-level mirrors the dismount class (the default risk view / current frontend reads these)
        "max_engagement_depth": dismount["max_engagement_depth"],
        "pct_in_kill_zone": dismount["pct_in_kill_zone"],
        "exposure": dismount["exposure"],
        "per_class": {c: _class_stats(c) for c in CLASSES},
        "note": "depth = overlapping fields of fire (>=2 = mutually-supporting kill zone). Risk is "
                "per target class (dismount/light_veh/armour) — a weapon that can't kill a class is "
                "omitted from its surface. dead_ground = hidden but NOT proven safe (vegetation is "
                "concealment, not cover; pending landcover.py).",
    }
    (BUILD / "fields.json").write_text(json.dumps(info))

    print(f"{n_direct} direct shooters | dismount depth {info['max_engagement_depth']} "
          f"| {info['pct_in_kill_zone']}% in a >=2 kill zone | {len(trps)} TRPs | classes {CLASSES}")
    print("wrote build/fields_cost_*.tif + fields_depth.tif + {danger,pfatal,depth,reason,conf,suppress}_<class>.bin + fields.json")
    return info


def main() -> None:
    ap = argparse.ArgumentParser(description="Project the enemy laydown into threat fields")
    ap.add_argument("--side", default="west", choices=["west", "east", "north", "south"])
    ap.add_argument("--res", type=float, default=2.0)
    a = ap.parse_args()
    run(a.side, a.res)


if __name__ == "__main__":
    main()
