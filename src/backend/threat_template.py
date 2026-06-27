"""Threat templating — infer LIKELY enemy positions from the terrain (IPB).

The enemy is an OUTPUT, not an input: given OUR avenue of approach (AA), the best
enemy direct-fire / observation positions are the terrain that can SEE and range
that approach, while having cover/concealment. We find them cheaply via viewshed
RECIPROCITY:

    run a viewshed from ~25 sample points along the AA, ACCUMULATE them
    → each cell's value = how much of our approach it can observe
    → × survivability (near cover) × thermal cue → rank → discrete positions

We run ~25 viewsheds total (one per AA point), NOT one per cell — cheap + scalable.

    uv run python src/backend/threat_template.py [--side west] [--res 2.0] [--k 6]

Outputs: build/threat_likelihood.tif + src/frontend/public/threat.{bin,json}
(per-web-point heatmap + ranked enemy positions for 3D markers).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
from scipy.ndimage import distance_transform_edt, maximum_filter, minimum_filter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.app import MAX_POINTS, VOXEL, pack_cloud  # noqa: E402
from src.backend.terrain import BUILD, DATA, box_polygon, build_dsm, save_geotiff  # noqa: E402
from src.backend.visibility import viewshed  # noqa: E402


def avenue_points(side: str, valid: np.ndarray, transform, n: int = 20) -> list[tuple[float, float]]:
    """Sample our avenue of approach as REAL terrain in the chosen edge band of the
    actual reconstruction footprint. (The old version sampled the bounding box, which
    is irregular — it put approach points in the void off the map.)"""
    ys, xs = np.where(valid)
    es = transform.c + (xs + 0.5) * transform.a
    ns = transform.f - (ys + 0.5) * (-transform.e)
    keep = {
        "west": es <= np.percentile(es, 18), "east": es >= np.percentile(es, 82),
        "south": ns <= np.percentile(ns, 18), "north": ns >= np.percentile(ns, 82),
    }[side]
    eb, nb = es[keep], ns[keep]
    if eb.size == 0:
        return []
    cross = nb if side in ("west", "east") else eb                 # spread across the band
    order = np.argsort(cross)
    idx = order[np.linspace(0, order.size - 1, min(n, order.size)).astype(int)]
    return [(float(eb[i]), float(nb[i])) for i in idx]


def load_friendly(data_dir: Path) -> list[tuple[float, float]] | None:
    """Operator-placed friendly positions (ground truth) — override the auto avenue.
    data/friendly.json: [[E, N], ...] in UTM. Doctrinally correct: the commander knows
    his own disposition; we template the enemy from where our troops actually are."""
    f = data_dir / "friendly.json"
    if not f.exists():
        return None
    return [(float(p[0]), float(p[1])) for p in json.loads(f.read_text())] or None


def main() -> None:
    ap = argparse.ArgumentParser(description="Infer likely enemy positions (threat template)")
    ap.add_argument("--side", default="west", choices=["west", "east", "north", "south"],
                    help="edge our force approaches from")
    ap.add_argument("--res", type=float, default=2.0, help="metres/cell (coarser = faster)")
    ap.add_argument("--range", type=float, default=1000.0, dest="rng", help="enemy obs/weapon range m")
    ap.add_argument("--k-obs", type=int, default=3, dest="k_obs", help="elevated observer/sniper positions")
    ap.add_argument("--k-at", type=int, default=2, dest="k_at", help="ground anti-armor (tank/ATGM) positions")
    ap.add_argument("--k-indirect", type=int, default=2, dest="k_indirect", help="indirect-fire (defilade) positions")
    args = ap.parse_args()

    t = build_dsm(DATA / "point_cloud.ply", args.res, DATA / "bounding_boxes.json")
    dsm, transform, bounds, (h, w) = t["dsm"], t["transform"], t["bounds"], t["shape"]
    boxes = json.loads((DATA / "bounding_boxes.json").read_text())

    # ---- 1. accumulate viewsheds from the avenue of approach (reciprocity) ----
    # operator-placed friendly positions (ground truth) win; else auto-sample REAL terrain
    friendly = load_friendly(DATA)
    aa = friendly or avenue_points(args.side, t["valid"], transform)
    aa_source = "operator (friendly.json)" if friendly else f"auto-{args.side}"
    aa_cx = float(np.mean([p[0] for p in aa]))               # AA centroid: shooters orient on it
    aa_cy = float(np.mean([p[1] for p in aa]))
    acc = np.zeros((h, w), dtype=np.float32)
    for (ax, ay) in aa:
        col = int((ax - transform.c) / transform.a)
        row = int((transform.f - ay) / (-transform.e))
        if not (0 <= row < h and 0 <= col < w):
            continue
        ground = float(dsm[row, col])
        vis, _, _ = viewshed(dsm, transform, args.res, (ax, ay), obs_z=ground,
                             eye_h=1.7, target_h=1.7, max_range=args.rng, arc_deg=360)
        acc += vis
    observation = acc / max(1, len(aa))                      # 0..1: fraction of approach a cell sees

    # ---- 2. survivability: near cover (boxes) is good; open ground is exposed ----
    cover = np.zeros((h, w), dtype=bool)
    from rasterio.features import rasterize
    cover = rasterize([(box_polygon(b), 1) for b in boxes], out_shape=(h, w),
                      transform=transform, fill=0, dtype="uint8").astype(bool)
    cover_dist = distance_transform_edt(~cover) * args.res   # metres to nearest cover
    survivability = np.clip(1.0 - cover_dist / 15.0, 0.2, 1.0)

    # ---- 3. thermal cue: hot objects (occupied/active) raise nearby likelihood ----
    temps = np.array([b["avg_temperature"] for b in boxes])
    tmin, tmax = float(temps.min()), float(temps.max())
    thermal = rasterize([(box_polygon(b), (b["avg_temperature"] - tmin) / (tmax - tmin) + 1e-3)
                         for b in boxes], out_shape=(h, w), transform=transform, fill=0,
                        dtype="float32")
    thermal = np.where(cover_dist < 12, thermal, 0.0)

    # ---- 4. DIRECT-fire suitability: observe + range our approach, with cover ----
    direct = observation * survivability * (1.0 + 0.4 * thermal)
    direct = np.where(t["valid"] | cover, direct, 0.0)
    if direct.max() > 0:
        direct /= direct.max()
    save_geotiff(direct, transform, t["epsg"], BUILD / "threat_likelihood.tif")
    score = direct                                           # heatmap drape = direct-fire dominance

    # ---- 5. INDIRECT-fire suitability: DEFILADE (hidden from our approach, in range) ----
    ground_lvl = minimum_filter(dsm, size=int(25 / args.res) | 1)
    hag = dsm - ground_lvl                                    # height above local ground
    gx, gy = np.gradient(ground_lvl, args.res, args.res)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    dist_to_overwatch = distance_transform_edt(~(observation > 0.5)) * args.res
    behind_mask = (observation < 0.05) & (dist_to_overwatch > 8) & (dist_to_overwatch < 90)
    emplaceable = (slope < 12) & (~cover) & t["valid"]
    indirect = (behind_mask & emplaceable).astype(np.float32) * (1.0 - dist_to_overwatch / 90.0)
    if indirect.max() > 0:
        indirect /= indirect.max()
    save_geotiff(indirect, transform, t["epsg"], BUILD / "defilade.tif")

    # ---- 6. extract a mixed laydown: elevated observers + ground anti-armor + indirect ----
    chosen: list[tuple[int, int]] = []

    def extract(smap: np.ndarray, k: int, role: str, atype: str, indirect: bool = False) -> list[dict]:
        out: list[dict] = []
        peaks = (smap == maximum_filter(smap, size=int(35 / args.res) | 1)) & (smap > 0.28)
        pr, pc = np.where(peaks)
        sep2 = (70.0 / args.res) ** 2
        for i in np.argsort(-smap[pr, pc]):
            if len(out) >= k:
                break
            r, c = int(pr[i]), int(pc[i])
            if any((r - sr) ** 2 + (c - sc) ** 2 < sep2 for sr, sc in chosen):
                continue
            chosen.append((r, c))
            E = transform.c + (c + 0.5) * transform.a
            N = transform.f - (r + 0.5) * (-transform.e)
            facing = 0.0 if indirect else float(np.degrees(np.arctan2(aa_cy - N, aa_cx - E)))
            out.append({
                "role": role, "type": atype,
                "world": [round(E, 1), round(N, 1), round(float(dsm[r, c]), 1)],
                "facing_deg": round(facing, 0),                  # oriented onto our avenue of approach
                "arc_deg": {"sniper_op": 200, "tank": 100}.get(atype, 0),  # sector of fire
                "score": round(float(smap[r, c]), 3),
                "sees_pct_of_approach": round(100 * float(observation[r, c]), 0),
                "cover_dist_m": round(float(cover_dist[r, c]), 1),
                "height_above_ground_m": round(float(hag[r, c]), 1),
                "thermal_cue": round(float(thermal[r, c]), 2),
                "defilade_m": round(float(dist_to_overwatch[r, c]), 1) if indirect else 0,
            })
        return out

    # Observers go on real building platforms (house/shelter) — NOT raw DSM canopy, which
    # would put a "sniper" on a treetop (trees aren't in the box set). Anti-armor sits on
    # low, trafficable ground. This fixes the most concrete placement bug.
    buildings = [b for b in boxes if b["class_label"] in ("house", "shelter")]
    on_building = (rasterize([(box_polygon(b), 1) for b in buildings], out_shape=(h, w),
                             transform=transform, fill=0, dtype="uint8").astype(bool)
                   if buildings else np.zeros((h, w), bool))
    ground = (~on_building) & (hag < 3)                      # low, on the deck (not canopy/roof)
    positions = (extract(np.where(on_building, direct, 0), args.k_obs, "observer", "sniper_op")
                 + extract(np.where(ground, direct, 0), args.k_at, "anti_armor", "tank")
                 + extract(indirect, args.k_indirect, "indirect", "mortar", indirect=True))
    for i, p in enumerate(positions):
        p["id"] = f"red_{i}"

    # ---- 6. per-web-point heatmap + positions for the viewer ----
    # Pack the exact same points the FastAPI app serves so the overlay aligns
    # (same fn + defaults => identical indices); write to build/, served by /api/threat.
    pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
    meta = pack["meta"]
    ox, oy = meta["origin"][0], meta["origin"][1]
    n = meta["n"]
    pts = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
    cols = ((pts[:, 0] + ox - transform.c) / transform.a).astype(np.int64)
    rows = ((transform.f - (pts[:, 1] + oy)) / (-transform.e)).astype(np.int64)
    ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
    heat = np.zeros(n, dtype=np.uint8)
    heat[ok] = (score[rows[ok], cols[ok]] * 255).astype(np.uint8)
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / "threat.bin").write_bytes(heat.tobytes())

    # positions carry world (UTM) coords; the viewer maps them with w2v()
    # `avenue` = where we templated OUR approach from — the input that drives enemy facing.
    info = {"side": args.side, "aa_points": len(aa), "range_m": args.rng,
            "avenue_source": aa_source,
            "avenue": [[round(x, 1), round(y, 1)] for x, y in aa],
            "avenue_centroid": [round(aa_cx, 1), round(aa_cy, 1)],
            "positions": positions}
    (BUILD / "threat.json").write_text(json.dumps(info))

    print(f"AA: {len(aa)} approach points from the {args.side}; {len(positions)} enemy positions surfaced")
    for p in positions:
        extra = (f"sees {p['sees_pct_of_approach']:.0f}% of approach" if p["role"] != "indirect"
                 else f"defilade {p['defilade_m']}m behind overwatch")
        print(f"  {p['id']:7} {p['type']:9} [{p['role']:10}] score {p['score']:.2f}  {extra}  "
              f"thermal {p['thermal_cue']}  @ {p['world'][0]:.0f}E {p['world'][1]:.0f}N")
    print(f"wrote {BUILD/'threat_likelihood.tif'} + threat.bin + threat.json")


if __name__ == "__main__":
    main()
