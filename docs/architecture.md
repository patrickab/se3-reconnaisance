# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). The system turns geometry into operator
judgments: where the enemy can observe, where friendly movement is exposed, what
ground is dead, and what decision points matter under time pressure.

## One-Line System

Provided 3D data -> FastAPI backend packs the point cloud and serves API data ->
React/Vite tactical viewer renders a three.js scene -> operator places the enemy
(enemy laydown is operator ground truth, not auto-templated) -> backend projects
fires/observation fields and serves per-point overlays for the viewer.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided point cloud and object boxes, gitignored | given |
| **Backend API** (`src/backend/app.py`) | FastAPI app that packs the cloud on startup, serves `api/*`, holds an in-memory unit-contact store | built |
| **Tactical layer** (`terrain.py`, `visibility.py`, `units.py`, `threat_template.py`, `fields.py`) | DSM + box occluders, radial LOS viewshed, doctrinal unit catalog, operator laydown, fires/observation projection | built |
| **Frontend** (`src/frontend/`) | React 18 + Vite + Tailwind UI; imperative three.js engine; unit placement, threat/danger/depth overlays | built |
| **Generated analysis** (`build/`) | `dsm.tif`, `viewshed.{tif,bin,json}`, `threat.{json,bin}`, `danger.bin`, `depth.bin`, `fields_cost_{dismount,mount}.tif`, `fields_depth.tif`, `fields.json` | generated, gitignored |

## Data Foundation

Two inputs share the same UTM metre frame and register directly, with no
alignment step.

- **`point_cloud.ply`**: binary little-endian PLY, single `vertex`, about
  **3,986,862 points**. Each point has `double x,y,z` in UTM/elevation plus
  `uchar red,green,blue` from photo texture, not class labels. Scene span is
  about **1264 x 775 m**, relief about **32 m**, density about **4 pts/m2**.
  This supports 2.5D surface reasoning, not volumetric interior reasoning.
- **`bounding_boxes.json`**: **58 oriented 3D boxes** for man-made objects only:
  shelter 19, house 15, container 16, wall 7, car 1. Each box has `center`,
  `extent`, yaw quaternion in `rotation`, and `avg_temperature`. Boxes are hard
  cover / LOS occluders; thermal values can cue possible occupancy.

## Runtime Data Flow

```text
data/point_cloud.ply
  -> io.read_ply() zero-copy memmap
  -> app.pack_cloud() voxel-downsample + recenter + sub-voxel horizontal jitter + RAM
  -> /api/meta + /api/cloud

data/bounding_boxes.json
  -> /api/boxes

terrain pass (cached by res_m):
  point cloud + boxes
    -> terrain.build_dsm() -> build/dsm.tif (max-height grid + box occluders)
    -> visibility.py -> build/viewshed.{tif,bin,json}
    -> /api/viewshed(+info)  |  POST /api/viewshed recomputes at a cursor

operator session (per-session, cleared on reset/restart):
  operator places units (POST /api/units, hostile + friendly)
    -> /api/units (list, side-filtered) + /api/unit-profiles (catalog)
    -> POST /api/threat/recompute
         -> threat_template.from_manual() -> build/threat.json (laydown)
         -> fields.run() -> build/{danger,depth}.bin + fields_cost_*.tif + fields.json
    -> /api/threat-info · /api/threat · /api/danger · /api/depth · /api/fields-info
    -> POST /api/threat/reset wipes the laydown + projected artifacts

browser:
  React app -> Zustand store -> SceneCanvas -> Viewer.ts three.js engine
  Panels (FriendlyPanel, ThreatPanel) + popups (Object/Threat/PlacedUnit via InfoPanelPopup)
  Color modes: rgb · height · temperature · viewshed · threat · danger · depth
```

## Coordinate Handling

UTM doubles exceed float32 precision in the browser. The backend stores served
positions relative to the local minimum corner in `pack_cloud()` and exposes the
origin/span through `/api/meta`. The viewer maps world coordinates through
`w2v(E,N,U)`: east -> X, elevation -> Y/up, north -> -Z, then recenters by scene
span. Scale is true 1:1 with no vertical exaggeration.

Cloud serving resolution is controlled by `src/config.json`:
`cloud.voxel_m = 0.1` and `cloud.max_points = 3900000` by default. To break the
DSM lattice moiré, served points get sub-voxel horizontal jitter (z untouched).

## Tactical Layer

The spine is **viewshed**, because observation gates lethality. The chain is now:

```text
terrain.py        DSM from cloud + 58 boxes stamped as solid occluders   [built]
visibility.py     radial LOS viewshed; range, arc, facing, eye/target h  [built]
units.py          doctrinal unit catalog (single source of truth)        [built]
threat_template   operator-placed enemies -> build/threat.json laydown   [built]
fields.py         fires/observation projection -> danger, depth, TRPs   [built]
routes.py         least-cost approach, covered axis, GO/NO-GO            [planned]
landcover.py      vegetation/concealment mask (separate from hard cover) [planned]
```

**`units.py`** is the single source of truth for per-type properties (range,
arc, role, fire kind). The `UNIT_CATALOG` is read by both the analysis chain
(`threat_template`, `fields`) and the frontend (`GET /api/unit-profiles`); no
side keeps a duplicate copy.

**`threat_template.py`** does *not* auto-template enemy positions — the operator
marks where the enemy actually is (`POST /api/units` with `side: hostile`), then
`POST /api/threat/recompute` turns those marks into a structured laydown that
`fields.py` projects. Direct-fire shooters are oriented onto friendly positions
(or the scene centre if none given); indirect units have no sector of fire.

**`fields.py`** design choices: continuous cost (not a red/green mask — the route
planner needs a gradient); engagement-area depth as a *count* of overlapping
shooters (>=2 = mutually-supporting kill zone); two target heights (dismount 1.7
m, mount 2.5 m); range-graduated lethality (`p_hit` decays past effective range,
fades to ~0.2 at max, 0 beyond); per-asset sector of fire; indirect fire =
mortar range AND (observed OR pre-registered TRPs on terrain-forced chokepoints,
detected via clearance medial-axis on the passable mask).

`visibility.py` / `fields.py` write georeferenced outputs for GIS reuse **and**
browser-specific per-point overlays aligned to the exact packed cloud served by
FastAPI. In the viewer: viewshed paints seen/dead; threat mode shows the laydown;
danger mode paints continuous risk; depth mode shows kill-zone overlap.

## Honest Limits

- Point cloud density and top-down capture enable surface-accurate 2.5D
  visibility over roofs, walls, canopy, and terrain, not see-through-wall or
  building-interior inference.
- The DSM treats tree canopy as a solid occluder, so dead ground behind
  vegetation is really *concealment* (hides you, doesn't stop a round). Until
  `landcover.py` exists this is tagged lower-confidence, not fully safe.
- Engagement envelopes are doctrinal models, not ballistic simulation.
- Red positions come from operator placement, not detection; `fields.py`
  projects what is marked, it does not discover the enemy. Confidence must be
  labeled rather than implied.
- The unit-contact store is in-memory and resets on server restart; the laydown
  is per-session and cleared by `/api/threat/reset` or on lifespan startup.
- With one temporal pass there is no change detection or live movement tracking.
