# Current Focus

## Where we are

Foundation + concept done, and the **core tactical primitive (viewshed) is built**
(Slice 1). Next is multiplying it into threat maps and routes.

- [x] Data ingest + inspection (`io.py`, `inspect_ply.py`, `render_rasters.py`).
- [x] Web 3D viewer: point cloud (RGB / height) + 58 semantic boxes (class /
      thermal), click-to-inspect, true 1:1 scale.
- [x] Tactical concept written: `THREAT_LIBRARY.md` (Red) +
      `MANEUVER_ANALYSIS.md` (Blue) — placing a Russian threat laydown and
      computing the friendly course of action.
- [x] **Slice 1 — viewshed engine.** `terrain.py` (DSM + 58 box occluders →
      `build/dsm.tif`) and `visibility.py` (radial line-of-sight → `build/
      viewshed.tif` + per-point overlay). Viewer has a **viewshed mode**
      (red = seen / green = dead ground), observer marker + range ring.

## Next (in order)

1. **`terrain.py` — vegetation mask** (concealment) to complement box cover.
   (DSM + occluders already done in Slice 1.)
2. **`data/enemy_assets.json`** — finalize schema (proposed in
   `THREAT_LIBRARY.md`), place Red assets in the viewer.
3. **Slice 2 — FastAPI** endpoint so the viewer can "drop a pin" and recompute a
   viewshed live (interactive enemy-perspective).
4. **`fields.py`** — threat maps: combined observation `O` (union of viewsheds),
   direct-fire `D`, indirect `I`; cover/concealment/traversability.
5. **`routes.py`** — approach-route cost surface → covered axis, bounds,
   chokepoints, dead ground.
6. Suppression priority (HVT) + go/no-go callout in MGRS, < 10 s.

## Open questions (gate everything — for the mentor)

- **Is there a second temporal pass?** Without it Track 2 (change detection)
  is dead and Track 1 is the only bet.
- **What does a "good" < 10 s output look like to the sponsor/operators?**
  Drives the composite-risk weights (`w_o, w_d, w_i, w_c, w_k`) and what
  counts as "significant."

## Notes

- Single-pass bonus available now: **thermal cueing** — flag warm structures
  (occupied / recently active) from `avg_temperature` to raise their
  likelihood of hosting a Red OP/weapon.
- Untracked stray file in repo root: `._point_cloud.ply` (macOS AppleDouble
  artifact, not real data — candidate for deletion).
