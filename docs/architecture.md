# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). The system turns geometry into operator
judgments: where the enemy can observe, where friendly movement is exposed, what
ground is dead, how lethal each cell is, and which placed soldiers are in danger
right now.

## One-Line System

Provided 3D data -> FastAPI backend packs the point cloud and serves API data ->
React/Vite tactical viewer renders a three.js scene -> operator marks the enemy
(type + heading + intel confidence; the laydown is operator ground truth, not
auto-templated) -> backend **auto-projects** the fires/observation fields the
moment the laydown changes (no "analyse" button) and serves per-point overlays ->
the viewer warns when a placed friendly soldier is exposed.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided point cloud and object boxes, gitignored | given |
| **Backend API** (`src/backend/app.py`) | FastAPI app that packs the cloud on startup, serves `api/*`, holds an in-memory unit-contact store, runs `threat/recompute` | built |
| **Tactical layer** (`terrain.py`, `visibility.py`, `units.py`, `threat_template.py`, `fields.py`) | DSM + box occluders, radial LOS viewshed, doctrinal unit catalog (weapon realism), operator laydown, per-target-class fires/observation projection | built |
| **Frontend** (`src/frontend/`) | React 18 + Vite + Tailwind UI; imperative three.js engine; 3D unit GLB models + NATO symbols; drag-to-place/move/remove; risk/crossfire/lethality overlays; danger alert | built |
| **Generated analysis** (`build/`) | `dsm.tif`, `viewshed.{tif,bin,json}`, `threat.json`, `fields_cost_{dismount,light_veh,armour}.tif`, `fields_depth.tif`, per-class `{danger,pfatal,depth,reason,conf,suppress}_<class>.bin`, `fields.json` | generated, gitignored |

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

terrain pass (cached per resolution by terrain_for()):
  point cloud + boxes
    -> terrain.build_dsm() -> build/dsm.tif (max-height grid + box occluders)
    -> visibility.py -> build/viewshed.{tif,bin,json}     (one-off, optional)
    -> /api/viewshed(+info)  |  POST /api/viewshed recomputes LOS at a cursor

operator session (in-memory unit store, cleared on reset/restart):
  operator places units (POST /api/units, hostile + friendly; 8 types, heading,
                         intel confidence) and can PATCH (move/reorient) or DELETE them
    -> /api/units (list, side-filtered) + /api/unit-profiles (catalog)
    -> the frontend AUTO-fires POST /api/threat/recompute on every laydown change
       (debounced, single-flight) — no explicit "analyse" step
         -> threat_template.from_manual() -> build/threat.json (laydown)
         -> fields.run() -> per-class build/{danger,pfatal,depth,reason,conf,suppress}_<class>.bin
                          + fields_cost_<class>.tif + fields_depth.tif + fields.json
    -> /api/threat-info · /api/{danger,pfatal,depth,reason,conf,suppress}?class=
       · /api/fields-info
    -> POST /api/threat/reset wipes the laydown + projected artifacts (blank field)

browser:
  React app -> Zustand store -> SceneCanvas -> Viewer.ts three.js engine
  HUD modes: rgb · height (base) | risk · depth (crossfire) · pfatal (analysis surfaces)
  "risk for" toggle picks the target class (Infantry/Light veh/Armour) the surface shows
  DangerAlert banner reads fields.json `soldiers` and warns on exposed friendlies;
  "locate" flies the camera (store.focusWorld -> Viewer.focusWorld) to the soldier
```

## Coordinate Handling

UTM doubles exceed float32 precision in the browser. The backend stores served
positions relative to the local minimum corner in `pack_cloud()` and exposes the
origin/span through `/api/meta`. The viewer maps world coordinates through
`w2v(E,N,U)` (and the inverse `v2w`, used for placement picking): east -> X,
elevation -> Y/up, north -> -Z, then recenters by scene span. Scale is true 1:1
with no vertical exaggeration.

Cloud serving resolution is controlled by `src/config.json`:
`cloud.voxel_m = 0.1` and `cloud.max_points = 3900000` by default. To break the
DSM lattice moiré, served points get sub-voxel horizontal jitter (z untouched).
`config.json` also carries `fires.exposure_shots` (the cumulative-exposure
multiplier read by `fields.py`).

## Tactical Layer

The spine is **viewshed**, because observation gates lethality. The chain is:

```text
terrain.py        DSM from cloud + 58 boxes stamped as solid occluders   [built]
visibility.py     vectorized radial LOS; range, arc, facing, eye/target h [built]
units.py          doctrinal unit catalog + weapon realism (single source) [built]
threat_template   operator-placed enemies -> build/threat.json laydown    [built]
fields.py         per-target-class fires/observation projection           [built]
routes.py         least-cost approach, covered axis, GO/NO-GO             [planned]
landcover.py      vegetation/concealment mask (separate from hard cover)  [planned]
```

**`units.py`** is the single source of truth for per-type properties, read by the
analysis chain (`threat_template`, `fields`) and the frontend (`GET
/api/unit-profiles`); no side keeps a duplicate. The `UNIT_CATALOG` covers **eight
types** — `tank`, `ifv`, `apc`, `assault`, `sniper`, `mortar`, `at_team`,
`atgm_team` (plus the legacy `sniper_op` alias -> `sniper`). The weapon-realism
model per type:

- **Two arcs**: `obs_arc` (wide OBSERVATION sector — "can they detect me?") and
  `weapon_arc` (narrow LETHAL sector of fire on the heading — "can they kill me
  here now?"). LOS is traced once at the wide obs arc, then masked to the weapon
  arc for lethality.
- **Hill `p_hit` curve** `ph_p0 / (1 + (d/d50)^ph_beta)` with `d50 = ph_shoulder *
  eff_range_m`; lethality decays with range instead of a hard edge. `min/eff/max`
  range bound the engagement annulus (`min_range_m` = mortar/ATGM dead zone).
- **Per-target-class effectiveness** `eff{dismount, light_veh, armour}` = P(kill |
  hit): a rifle is lethal to dismounts but ~0 vs armour, so the same laydown
  threatens each class differently.
- **Suppression** `supp_s0` (MG beaten-zone plateau; 0 for precision weapons).
- `TargetClass` enum + `TARGET_HEIGHT_M` (dismount 1.7 m; light_veh/armour 2.5 m)
  drive which of the two viewshed heights a class is evaluated at.

`UnitContact` is a placed instance (position + intel `confidence` + `azimuth` +
`source`); `PlaceUnitRequest`/`UpdateUnitRequest` are the POST/PATCH bodies.

**`threat_template.py`** does *not* auto-template enemy positions — the operator
marks where the enemy actually is. `from_manual()` turns the placed enemies into
`build/threat.json`, converting each operator heading (compass azimuth) into a
viewshed facing (`facing_deg = 90 - azimuth`); indirect units get no sector of
fire. Friendly positions become the laydown's `avenue` points and set
`avenue_source = 'operator'` — the gate the frontend uses before revealing any
threat.

**`fields.py`** `run()` projects the laydown **per target class**:

- Each direct-fire shooter's observation viewshed (memoised in a per-shooter
  content-keyed cache, so editing one unit re-sweeps one unit) is masked to its
  weapon arc + range band; `P(kill) = visible × p_hit × eff[class]`, combined as a
  probabilistic union over shooters with the per-contact intel `confidence` and
  the `exposure_shots` multiplier folded in.
- **Engagement depth** = a count of overlapping killing weapons per cell (>=2 = a
  mutually-supporting kill zone / crossfire).
- **Indirect fire** = the mortar range annulus AND (observed by any eyes OR a
  pre-registered TRP on a terrain-forced chokepoint, found via a clearance
  medial-axis on the passable mask).
- **Cover** (boxes stop rounds) reduces the continuous routing `cost`.
- Separate from `cost`, **`pfatal`** is a true marginal P(lethal enemy fire) —
  the independent union of direct + indirect lethal hits, each weighted by P(kill
  | hit) and P(enemy actually placed here), with no cover credit or kill-zone
  emphasis.
- **`reason`** classifies why a cell is (un)safe: 0 out-of-range, 1 dead-ground,
  2 cover, 3 exposed. **`conf`** is the intel confidence the cell is threatened;
  **`suppress`** is the beaten-zone field.
- **Per-soldier exposure**: each placed friendly (`threat.json` avenue point) is
  classified into a risk zone (`kill_zone` / `high` / `moderate` / `low`) on the
  dismount surface and written to `fields.json` `soldiers`, which drives the
  DangerAlert banner.

Outputs are both georeferenced GeoTIFFs (GIS reuse) and per-point `.bin` overlays
aligned to the exact packed cloud FastAPI serves. The class-suffixed surface
endpoints (`/api/danger`, `/pfatal`, `/depth`, `/reason`, `/conf`, `/suppress`)
take `?class=` (default `dismount`).

## Frontend

The engine (`Viewer.ts`) owns the imperative three.js world; React components only
read/write the Zustand store, and `SceneCanvas` forwards store -> engine via
effects.

- **3D models + symbology**: placed units render as **GLB models**
  (`public/assets/<type>.glb`, loaded with `GLTFLoader` + `MeshoptDecoder`) under
  scene lighting (hemisphere + directional sun); NATO symbols are drawn with
  `milsymbol`.
- **Placement**: drag-to-place (drag to orient enemy heading), drag-to-move, and
  remove are mutually-exclusive map modes; ESC cancels.
- **Overlays**: `risk` (banded classification via `riskBand()`), `depth`
  (crossfire indicator), and `pfatal` (probability of lethal fire) read the
  per-class `.bin` arrays, re-fetched on the "risk for" class toggle; these
  surfaces auto-blend onto the RGB photo.
- **Auto-project + alert**: `SceneCanvas` debounces a single-flight
  `recompute` on every laydown change (the `AnalyzingSpinner` pill is the only
  visible signal); `DangerAlert` tiers exposed soldiers and "locate" flies the
  camera to them via `focusWorld`.

## Honest Limits

- Point cloud density and top-down capture enable surface-accurate 2.5D
  visibility over roofs, walls, canopy, and terrain, not see-through-wall or
  building-interior inference.
- The DSM treats tree canopy as a solid occluder, so dead ground behind
  vegetation is really *concealment* (hides you, doesn't stop a round). Until
  `landcover.py` exists this is tagged lower-confidence, not fully safe.
- Engagement envelopes are doctrinal models (Hill `p_hit`, per-class `eff`), not
  ballistic simulation.
- Red positions come from operator placement, not detection; `fields.py`
  projects what is marked, it does not discover the enemy. Per-contact intel
  confidence is carried through to the surfaces rather than implied.
- The unit-contact store is in-memory and resets on server restart; the laydown
  is per-session and cleared by `/api/threat/reset` or on lifespan startup.
- With one temporal pass there is no change detection or live movement tracking.
