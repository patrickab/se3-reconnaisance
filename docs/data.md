# Data findings (inspected, not assumed)

What the provided files *actually* contain — verified by parsing them, because
the marketing ("segmented, semantically labeled") and the delivery differ.

## Point cloud — `data/point_cloud.ply`

- Binary little-endian, single `vertex` element, **3,986,862 points**.
- Per point: `double x,y,z` + `uchar red,green,blue`. **No labels, no normals.**
- Colour is real photo texture (25,778 unique colours in a 200k sample) — *not*
  a class palette.
- **Georeferenced UTM, metres.** Origin ≈ E 717039 / N 5355383 (~48.3°N, central
  Europe). `z` = true elevation ASL.
- Extent **1264 × 775 m**, relief **32.5 m** (449.9 → 482.3 m). Density ≈ 4 pts/m²
  (57% of 0.5 m cells occupied) — good for terrain & building massing, marginal
  for fine detail (individual windows / people).
- The scene is a **military training area**: airstrip, road net, barracks rows, a
  MOUT-style village, hangars, treelines, open fields.

## Semantic layer — `data/bounding_boxes.json`

- **58 oriented 3D boxes**, man-made objects only: shelter 19 · house 15 ·
  container 16 · wall 7 · car 1.
- Each: `center` [E,N,U] UTM · `extent` [L,W,H] m · `rotation` yaw quaternion
  `[0,0,qz,qw]` · **`avg_temperature` °C**.
- Temperature 9.8–25.4 °C. Hottest: `34_house` 25.4, `28_house` 21.3,
  `5_container` 19.3 → candidate "occupied / recently active".
- **Registration confirmed**: boxes drop exactly onto the structures in the cloud
  → both share the same UTM frame, no co-registration needed.

## Implications

1. **Track 2 (change detection) is blocked** — only one temporal pass exists.
   Confirm with the mentor whether a second pass is coming; otherwise Track 1 is
   the only viable bet.
2. **No per-point semantics, but the right objects are labeled.** Buildings/walls
   = sightline occluders + hard cover, handed over as cheap geometric primitives
   (ray-test 58 boxes, not 4M points). Terrain + vegetation we derive from the
   cloud (vegetation = concealment).
3. **"True 3D" claim must be calibrated** to surface-accurate multi-level
   visibility (roofs/walls/canopy beat a flat heightmap) — not volumetric.
4. **Georeferenced UTM is a free win**: output real grid references + metric ranges.
5. **Thermal = single-pass activity signal** the geometry alone can't give.

## Reproduce

```bash
uv run python src/backend/scripts/inspect_ply.py        # header + stats
uv run python src/backend/scripts/render_rasters.py     # ortho / DSM / height-above-ground (-> docs/figures/, gitignored)
```
