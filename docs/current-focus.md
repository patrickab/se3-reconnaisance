# Current Focus

## Where we are

Foundation + concept done. Next is the **first tactical primitive**.

- [x] Data ingest + inspection (`io.py`, `inspect_ply.py`, `render_rasters.py`).
- [x] Web 3D viewer: point cloud (RGB / height) + 58 semantic boxes (class /
      thermal), click-to-inspect, true 1:1 scale.
- [x] Tactical concept written: `THREAT_LIBRARY.md` (Red) +
      `MANEUVER_ANALYSIS.md` (Blue) — placing a Russian threat laydown and
      computing the friendly course of action.

## Next (in order)

1. **`terrain.py`** — derive ground surface + vegetation mask from the cloud
   (cover vs concealment).
2. **`visibility.py`** — viewshed / line-of-sight on terrain + the 58 box
   occluders. *The core primitive; everything else falls out of it.*
3. **`data/enemy_assets.json`** — finalize schema (proposed in
   `THREAT_LIBRARY.md`), place Red assets in the viewer.
4. **`fields.py`** — threat maps: combined observation `O`, direct-fire `D`,
   indirect `I`; cover/concealment/traversability.
5. **`routes.py`** — approach-route cost surface → covered axis, bounds,
   chokepoints, dead ground.
6. Suppression priority (HVT) + go/no-go callout in MGRS, < 10 s.
7. Enemy-perspective viewshed (drop a pin → what they see & threaten).

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
