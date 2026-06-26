# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). Turns labeled geometry into operator
judgments — *where is the enemy likely to approach, where do I have field of
fire, where am I exposed* — fast and legible.

## One-line system

Provided 3D data → Python ingest/processing → packed web assets → interactive
three.js viewer. Tactical analysis (viewshed engine + threat maps + routes) is
the **next** layer, not yet built.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided inputs, gitignored: point cloud + object boxes | given |
| **Backend** (`src/backend/`) | Python IO, raster/web prep scripts | built |
| **Frontend** (`src/frontend/`) | Static three.js 3D viewer, no build step | built |
| **Tactical layer** (`src/backend/`) | viewshed → threat maps → routes | planned |

## Data (the foundation)

Two files, same **UTM frame** (metres) — register directly, no alignment.

- **`point_cloud.ply`** — binary LE, single `vertex`, **3,986,862 points**.
  `double x,y,z` (UTM: x=easting, y=northing, z=elevation ASL) + `uchar
  red,green,blue` (real photo texture, *not* class codes). No labels, no
  normals. Scene ≈ **1264 × 775 m**, relief **32 m**, density ≈ **4 pts/m²**
  (top-down → 2.5D surface, not volumetric). Military training area.
- **`bounding_boxes.json`** — **58 oriented 3D boxes**, man-made objects only
  (shelter 19 · house 15 · container 16 · wall 7 · car 1). Each: `center`
  [E,N,U], `extent` [L,W,H], `rotation` yaw quaternion, `avg_temperature` °C
  (9.8–25.4; warm ⇒ possibly occupied). These are the sightline occluders /
  hard cover Track 1 needs — ray-test 58 boxes, not 4M points.

## Data flow

```
data/point_cloud.ply ──► io.read_ply (memmap, zero-copy numpy struct array)
       │                        │
       │                        ├─► inspect_ply.py    → header + stats (sanity)
       │                        ├─► render_rasters.py → ortho/DSM/HAG PNGs (gitignored)
       │                        └─► prepare_web.py    → voxel-downsample, recenter
       │                                                  to local origin, pack binary
       ▼                                                  │
data/bounding_boxes.json ──────────────────────────────► │
                                                          ▼
                              src/frontend/public/  (cloud.bin, meta.json, bounding_boxes.json)
                                                          │
                                                          ▼
                              index.html (three.js via CDN) — interactive viewer
```

**Coordinate handling:** UTM doubles exceed float32 precision, so
`prepare_web.py` recenters to a local origin (`meta.json`); the browser works
in metres from that origin. Frame mapping in viewer: **east → X, elevation →
Y (up), north → −Z**. True 1:1 scale, no vertical exaggeration.

## Planned tactical layer

Spine = **one primitive, the viewshed**, because *observation gates
lethality*: direct fire = a weapon sees you & in range; indirect fire = any
observer sees you, in range, kill-chain closes. Build order (all share the
visibility primitive):

```
terrain.py    derive ground surface + vegetation mask from cloud
   ↓          (cover = boxes stop fire; concealment = vegetation hides only)
visibility.py viewshed / LOS on terrain + 58 box occluders   ← core
   ↓
fields.py     O (combined observation), D (direct-fire), I (indirect),
   ↓          cover C, concealment K, traversability T → composite risk
routes.py     least-cost approach (A*/Dijkstra on cost raster)
              → covered axis, bounds, chokepoints, dead ground, HVT, go/no-go
```

Red laydown (`data/enemy_assets.json`, proposed) places a realistic Russian
threat model into the zone; Blue maneuver analysis computes the friendly
course of action against it. See `docs/THREAT_LIBRARY.md` (Red) and
`docs/MANEUVER_ANALYSIS.md` (Blue).

## Honest limits (stated to the jury)

- ~4 pts/m² top-down → **surface-accurate multi-level visibility** (real
  roofs/walls/canopy beat a flat heightmap), *not* see-through walls.
- Engagement envelopes are **doctrinal models**, not ballistics.
- Red positions **templated/suspected** unless thermally cued; confidence
  labeled, never a guess shown as confirmed contact.
- One temporal pass → **no change detection** (Track 2 blocked).
