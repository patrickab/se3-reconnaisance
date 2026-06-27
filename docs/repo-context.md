This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where content has been compressed (code blocks are separated by ⋮---- delimiter).

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.docs/
  architecture.md
  conventions.md
  current-focus.md
  module-map.md
.github/
  dependabot.yml
data/
  README.md
docs/
  architecture.md
  challange.md
  conventions.md
  current-focus.md
  data.md
  MANEUVER_ANALYSIS.md
  module-map.md
  repo-context.md
  THREAT_LIBRARY.md
src/
  backend/
    scripts/
      inspect_ply.py
    __init__.py
    app.py
    fields.py
    io.py
    README.md
    terrain.py
    threat_template.py
    units.py
    visibility.py
  frontend/
    public/
      .gitkeep
    src/
      components/
        FriendlyPanel.tsx
        Hud.tsx
        InfoPanelPopup.tsx
        ObjectPopup.tsx
        PlacedUnitPopup.tsx
        SceneCanvas.tsx
        Sidebar.tsx
        ThreatPanel.tsx
        ThreatPopup.tsx
      engine/
        Viewer.ts
      lib/
        api.ts
        colors.ts
        store.ts
        types.ts
        utils.ts
      App.tsx
      index.css
      main.tsx
    index.html
    package.json
    postcss.config.js
    README.md
    tailwind.config.js
    tsconfig.json
    vite.config.ts
  __init__.py
  config.json
.gitignore
pyproject.toml
README.md
run.sh
```

# Files

## File: .docs/architecture.md
`````markdown
# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). The system turns geometry into operator
judgments: where the enemy can observe, where friendly movement is exposed, what
ground is dead, and what decision points matter under time pressure.

## One-Line System

Provided 3D data -> FastAPI backend packs the point cloud and serves API data ->
React/Vite tactical viewer renders a three.js scene -> optional generated
viewshed layers add line-of-sight decision support. The first tactical primitive,
DSM-backed viewshed, is built; threat maps and routing are next.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided point cloud and object boxes, gitignored | given |
| **Backend API** (`src/backend/app.py`) | FastAPI app that packs the cloud on startup and serves `api/*` | built |
| **Tactical layer** (`src/backend/terrain.py`, `visibility.py`) | DSM + box occluders, radial line-of-sight viewshed, generated overlays | Slice 1 built |
| **Frontend** (`src/frontend/`) | React 18 + Vite + Tailwind UI; imperative three.js engine | built |
| **Generated analysis** (`build/`) | `dsm.tif`, `viewshed.tif`, `viewshed.bin`, `viewshed.json` | generated, gitignored |

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
  -> app.pack_cloud() voxel-downsample + recenter to local origin
  -> /api/meta + /api/cloud

data/bounding_boxes.json
  -> /api/boxes

optional analysis:
  point cloud + boxes
    -> terrain.build_dsm() -> build/dsm.tif
    -> visibility.py -> build/viewshed.tif + build/viewshed.{bin,json}
    -> /api/viewshed + /api/viewshed-info

browser:
  React app -> Zustand store -> SceneCanvas -> Viewer.ts three.js engine
  Sidebar/HUD -> color mode, layers, selected object, viewshed readout
```

## Coordinate Handling

UTM doubles exceed float32 precision in the browser. The backend stores served
positions relative to the local minimum corner in `pack_cloud()` and exposes the
origin/span through `/api/meta`. The viewer maps world coordinates through
`w2v(E,N,U)`: east -> X, elevation -> Y/up, north -> -Z, then recenters by scene
span. Scale is true 1:1 with no vertical exaggeration.

Cloud serving resolution is controlled by `src/config.json`:
`cloud.voxel_m = 0.1` and `cloud.max_points = 3900000` by default.

## Tactical Layer

The spine is **viewshed**, because observation gates lethality: direct fire needs
weapon LOS and range; indirect fire needs an observer, range, and a closed kill
chain. Current build order:

```text
terrain.py
  DSM from cloud + 58 boxes stamped as solid occluders      [built]
  vegetation/concealment mask                              [next]

visibility.py
  radial LOS viewshed on DSM with eye/target height,
  range, arc, facing, roof-edge OP placement               [built]

fields.py
  combined observation O, direct fire D, indirect fire I,
  cover C, concealment K, traversability T                 [planned]

routes.py
  least-cost approach, covered axis, dead ground,
  chokepoints, HVT/suppression priority, GO/NO-GO          [planned]
```

`visibility.py` writes georeferenced outputs for GIS reuse and browser-specific
per-point overlays aligned to the exact packed cloud served by FastAPI. In the
viewer, viewshed mode paints points red for seen and green for dead ground, plus
an observer marker and range ring.

## Honest Limits

- Point cloud density and top-down capture enable surface-accurate 2.5D
  visibility over roofs, walls, canopy, and terrain, not see-through-wall or
  building-interior inference.
- Engagement envelopes are doctrinal models, not ballistic simulation.
- Red positions remain templated/suspected unless cued, for example by thermal
  signal. Confidence must be labeled rather than implied.
- With one temporal pass there is no change detection or live movement tracking.
`````

## File: .docs/conventions.md
`````markdown
# Conventions

## Stack

- **Python >= 3.12**, managed by **uv**. Package root is `src`; build backend is hatchling.
- Backend dependencies: `numpy`, `fastapi`, `uvicorn[standard]`, `rasterio`, `shapely`, and `scipy`.
- **Backend:** FastAPI in `src/backend/app.py`; tactical analysis scripts/modules in `src/backend/`.
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + three.js + Zustand under `src/frontend/`.
- Shared runtime config is `src/config.json`: backend host/port, frontend port, and cloud voxel/max-point settings.

## Python Style

- Ruff is the configured formatter/linter: line length 135, target `py312`, Black-compatible format.
- Ruff lint select: `E F I B C4 TCH SIM ANN ARG RUF`; ignored: `RUF100`, `B904`.
- isort order: future, standard-library, third-party, first-party, local-folder; force-sort within sections.
- Type hints are expected. Scripts use module docstrings with usage examples, `argparse`, and a `main()` entrypoint.
- Data-heavy code is numpy-first and favors vectorized operations, memmaps, deterministic sampling, and avoiding unnecessary copies.
- Comments should be terse and explain why, especially around coordinate precision, geospatial transforms, and LOS assumptions.

## Frontend Style

- TypeScript is strict: `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled.
- React owns UI state and layout; `Viewer.ts` owns the three.js scene graph imperatively. Do not let React mutate three.js objects directly.
- Use Zustand store state/actions for viewer metadata, boxes, viewshed readiness, layers, color mode, selection, loading, and error state.
- Tailwind is the styling system. Tactical color tokens live in `tailwind.config.js`; reusable component utilities are in `src/index.css`.
- Frontend API calls should use relative `/api/...` URLs so Vite proxy works in dev and same-origin works in production.

## Naming And Coordinates

- Python files/functions use `snake_case`; TypeScript components use `PascalCase`; frontend helpers/types use idiomatic TS naming.
- Box class labels are `car | container | wall | house | shelter`.
- OPFOR conceptual labels in docs include `sniper | tank | atgm | ifv | mortar | howitzer | mlrs | uav_recon | ew`.
- Coordinates are UTM metres. Browser view frame is east -> X, elevation -> Y/up, north -> -Z.
- Outputs should prefer UTM/MGRS grid references and metres because operator-facing decisions are grid-based.

## Data Discipline

- Never commit provided data or generated analysis: `data/*.{ply,json,pcd,las,laz,bag}`, `build/`, rendered figures, screenshots, and frontend build/cache outputs are ignored.
- Verify dataset claims by parsing files, not by trusting descriptions. Use `inspect_ply.py` and documented stats in `docs/data.md`.
- `.docs/repo-context.md` is generated by repomix. Do not hand-edit it.
- Repomix output may include generated cache files if they are present and not ignored; do not treat `src/frontend/.vite/` as source.

## Git / Workflow

- Work on feature branches off `main`.
- Agents must not commit, push, or amend unless the user explicitly asks.
- Dependabot is configured for weekly pip updates, grouped.

## Information Panel Popup

Any popup that surfaces details for a scene object uses `InfoPanelPopup` (`src/frontend/src/components/InfoPanelPopup.tsx`).

**Contract:**
- `screen: ScreenPoint | null` — projected screen position of the anchor world coordinate. The Viewer's render loop calls `emitCursorScreen()` each frame, which projects `cursorAnchor` (a UTM world coord) into screen space and pushes the result into `store.selectedCursor.screen`. This makes the popup follow the object as the camera moves, unlike a raw click-position which would drift.
- `header` — ReactNode rendered alongside the close button.
- `onClose` — clears the relevant store selection (`select(null)`, `selectThreat(null)`, `selectPlacedUnit(null)`).
- `children` — detail rows, typically using the exported `DataRow` component.

**Wiring a new popup:**
1. Store action sets `selectedCursor: { screen: clickPos, world: utmCoord }` and the relevant selection field.
2. Viewer calls `setCursorAnchor(world)` (via `SceneCanvas` effect) so the render loop tracks it.
3. The popup component reads `selectedCursor.screen` for position and its own selection slice for content.
4. Wrap with `InfoPanelPopup` — no bespoke position arithmetic needed.

**Existing consumers:** `ObjectPopup` (bounding boxes), `ThreatPopup` (analyzed threat positions), `PlacedUnitPopup` (operator-placed enemies and friendlies).

## Testing And Checks

- No comprehensive automated test suite is present yet.
- Backend sanity checks: `uv run python src/backend/scripts/inspect_ply.py` and `uv run python src/backend/visibility.py` when data is available.
- Frontend build check: `npm --prefix src/frontend run build`.
- Keep tactical outputs operator-actionable in under 10 seconds and be explicit about model/data limits.
`````

## File: .docs/current-focus.md
`````markdown
# Current Focus

## Where We Are

Foundation, concept docs, the FastAPI-backed viewer, and the first tactical
primitive are in place.

- [x] Data ingest and inspection: `io.py`, `inspect_ply.py`.
- [x] FastAPI backend: packs the cloud on startup and serves `/api/meta`, `/api/cloud`, `/api/boxes`, and optional viewshed endpoints.
- [x] React/Vite tactical viewer: point cloud, semantic boxes, RGB/elevation/viewshed color modes, layer toggles, selected-object inspection, keyboard navigation, true 1:1 scale.
- [x] Tactical concept docs: `THREAT_LIBRARY.md` for Red/OPFOR assets and `MANEUVER_ANALYSIS.md` for Blue maneuver outputs.
- [x] Slice 1 viewshed: `terrain.py` builds the DSM and stamps 58 box occluders; `visibility.py` computes radial LOS and writes `build/viewshed.*` for GIS and viewer overlay use.

## Active Work

- UI/UX is being refit toward a tactical C2 design philosophy: glance-first,
  honest uncertainty, semantic color, redundant shape/text encoding, spatial
  constancy, visible degraded/missing-data states, and no hover-only critical
  controls.
- Current frontend implementation is still comparatively sparse: HUD, sidebar,
  color modes, layer toggles, selected-object rows, and connection error overlay.
  The next UI pass should add clearer alert/degradation/status treatment without
  breaking the existing viewer pipeline.

## Next In Order

1. **Tactical C2 UI pass**: remove decorative/low-value UI, make system status and data boundaries explicit, strengthen semantic alert/color treatment, and keep controls visible for gloved/keyboard operation.
2. **`terrain.py` vegetation mask**: derive concealment separately from hard cover.
3. **`data/enemy_assets.json`**: finalize schema from `THREAT_LIBRARY.md` and place Red assets in the viewer.
4. **Interactive viewshed endpoint**: allow the viewer to drop/select an observer and recompute enemy-perspective LOS live.
5. **`fields.py`**: combined observation `O`, direct fire `D`, indirect fire `I`, cover `C`, concealment `K`, traversability `T`, and composite risk.
6. **`routes.py`**: least-cost approach, covered axis, bounds, chokepoints, dead ground, suppression priority, GO/NO-GO output.

## Open Questions

- Is there a second temporal pass? Without it, Track 2 change detection remains blocked.
- What exactly counts as a sponsor/operator-good output in under 10 seconds? This gates risk weights and what the UI should escalate.
- What confidence vocabulary should be standardized across suspected Red positions, thermal cues, stale viewshed products, and missing sensors?

## Notes

- Single-pass thermal cueing remains valuable: warm structures from `avg_temperature` can raise suspected OP/weapon likelihood without claiming confirmation.
- Generated `build/` layers are absent until scripts run; the UI must represent this as unavailable/degraded data, not as an empty or silently disabled state.
- `src/frontend/.vite/` appeared in the latest repomix output but is generated cache and should be ignored architecturally.
`````

## File: .docs/module-map.md
`````markdown
# Module Map

```text
.
├── data/                         provided inputs, gitignored
├── build/                        generated DSM/viewshed layers, gitignored
├── src/
│   ├── backend/                  Python IO, FastAPI, tactical analysis
│   │   ├── app.py                API server and cloud packer
│   │   ├── io.py                 zero-copy PLY reader
│   │   ├── terrain.py            DSM + box occluders
│   │   ├── visibility.py         radial LOS viewshed
│   │   ├── README.md             backend notes and roadmap
│   │   └── scripts/
│   │       └── inspect_ply.py    data sanity-check CLI
│   ├── frontend/                 React/Vite/three.js tactical UI
│   │   ├── src/
│   │   │   ├── components/       HUD, sidebar, canvas mount
│   │   │   ├── engine/           imperative three.js viewer
│   │   │   ├── lib/              API, store, types, colors, utils
│   │   │   ├── App.tsx           root layout
│   │   │   ├── index.css         Tailwind layers/component classes
│   │   │   └── main.tsx          React entrypoint
│   │   ├── index.html            Vite HTML shell
│   │   ├── package.json          npm scripts/deps
│   │   ├── tailwind.config.js    tactical color tokens
│   │   └── vite.config.ts        Vite + API proxy config
│   └── config.json               shared backend/frontend ports + cloud settings
├── docs/                         project/domain docs
├── .docs/                        agent context summaries + generated repomix dump
├── pyproject.toml                Python package/deps/ruff config
└── run.sh                        starts backend and frontend dev servers
```

## Backend — `src/backend/`

| File | Responsibility |
|------|----------------|
| `io.py` | **Zero-copy PLY reader.** `read_ply(path)` memory-maps binary little-endian PLY vertex data into a numpy structured array. The dtype is built from the header, so added properties are picked up automatically. |
| `app.py` | **FastAPI server.** On startup, `pack_cloud()` voxel-downsamples the PLY, recenters positions to local origin, and stores packed bytes in RAM. Endpoints: `/api/meta`, `/api/cloud`, `/api/boxes`, `/api/viewshed`, `/api/viewshed-info`. Reads shared settings from `src/config.json`; CORS is enabled for the Vite dev server. |
| `terrain.py` | **DSM builder.** `build_dsm()` creates a max-height grid from the cloud, rasterizes the 58 oriented boxes as solid occluders, nearest-fills gaps, and saves `build/dsm.tif`. Helpers include `box_yaw`, `box_polygon`, `world_to_pixel`, and `save_geotiff`. |
| `visibility.py` | **Viewshed engine.** Computes radial line-of-sight from an observer on the DSM using range, arc, facing, eye height, and target height. Auto-places the default observer on a roof edge. Writes `build/viewshed.tif`, `build/viewshed.bin`, and `build/viewshed.json` for API/viewer use. |
| `scripts/inspect_ply.py` | Prints PLY header, axis stats, color uniqueness sample, and elevation percentiles for sanity checks. |

Planned backend modules still live conceptually after the visibility primitive:
`fields.py` for threat/observation/lethality rasters and `routes.py` for
least-cost maneuver outputs.

## Frontend — `src/frontend/`

| File | Responsibility |
|------|----------------|
| `src/App.tsx` | Root full-screen tactical layout. Renders `SceneCanvas`, `Hud`, error overlay, and `Sidebar`. |
| `src/components/SceneCanvas.tsx` | Mounts the three.js engine once and forwards Zustand store changes into it. |
| `src/components/Hud.tsx` | Top-left mission/status HUD showing scene span, point count, object count, and keyboard controls. |
| `src/components/Sidebar.tsx` | Right-side controls for color mode (`rgb`, `height`, `viewshed`), layers (`points`, `boxes`, `observer`), selected-object inspection, and viewshed stats. |
| `src/engine/Viewer.ts` | Imperative three.js world. Owns renderer, scene graph, OrbitControls, point cloud, semantic boxes, observer marker, range ring, selection, keyboard movement, layer visibility, and color-mode switching. Caches the cloud per page load. |
| `src/lib/api.ts` | Typed fetch helpers for required API data and optional viewshed data. Uses relative URLs so Vite proxy works in dev and same-origin works in production. |
| `src/lib/store.ts` | Zustand app state: metadata, boxes, viewshed info/readiness, loading/error, color mode, layers, and selected box. |
| `src/lib/types.ts` | Shared TypeScript interfaces for `CloudMeta`, `BoundingBox`, `ViewshedInfo`, color modes, and layer keys. |
| `src/lib/colors.ts` | Class colors and Turbo colormap. Tactical palette tokens are in Tailwind config. |
| `src/lib/utils.ts` | `w2v()` coordinate mapping from UTM world space to viewer space. |
| `src/index.css` | Tailwind base/components. Defines `.panel` and `.hud-text`. |

`src/frontend/.vite/` appeared in the generated repomix output but is a generated
Vite cache, not source architecture.

## Data — `data/`

Expected files are `point_cloud.ply` and `bounding_boxes.json`. They are large or
sensitive and gitignored. `data/README.md` documents the drop-in requirement.

## Docs — `docs/`

| File | Content |
|------|---------|
| `challange.md` | EDTH/SE3 challenge brief and chosen Track 1 direction. |
| `data.md` | Parsed dataset facts and implications. |
| `THREAT_LIBRARY.md` | OPFOR asset model, sensor/weapon envelopes, proposed `enemy_assets.json`. |
| `MANEUVER_ANALYSIS.md` | Blue COA concept: O/D/I/C/K/T layers, risk, routes, operator outputs. |
| `architecture.md`, `module-map.md`, `conventions.md`, `current-focus.md` | Team/agent context copies under `docs/`; `.docs/` is the injected source of truth. |

## Run / Build

- `./run.sh` starts FastAPI through uvicorn and Vite dev server using ports from `src/config.json`.
- `uv run python src/backend/visibility.py` optionally generates the viewshed overlay consumed by `/api/viewshed*` and the frontend.
- `npm --prefix src/frontend run build` runs TypeScript checks and a Vite production build.
`````

## File: .github/dependabot.yml
`````yaml
# .github/dependabot.yml

version: 2
updates:

  # Main rule for your Python dependencies
  - package-ecosystem: "pip"
    directory: "/" # Look for pyproject.toml in the root directory
    schedule:
      interval: "weekly"

    reviewers:
      - "patrickab"

    # Group related updates to reduce PR noise
    groups:
      streamlit-plugins:
        patterns:
          - "streamlit*"
          - "st-copy"
`````

## File: data/README.md
`````markdown
# Data

**The files in this folder are NOT committed** (see `.gitignore`). Get them from
the SE3 mentor and drop them here:

```
data/point_cloud.ply
data/bounding_boxes.json
```

## `point_cloud.ply`

Binary little-endian PLY, single `vertex` element, **3,986,862 points**.

| property | type | meaning |
|----------|------|---------|
| `x`, `y`, `z` | `double` | position in **UTM** (metres). `x`=easting, `y`=northing, `z`=elevation ASL |
| `red`, `green`, `blue` | `uchar` | photographic colour (real texture, *not* class codes) |

No normals, no per-point labels. Georeferenced; ~48.3°N (central Europe).
Scene ≈ **1264 × 775 m**, relief ≈ **32 m** (449.9–482.3 m ASL). ~4 pts/m².

## `bounding_boxes.json`

Array of **58 oriented 3D object boxes** — the semantic layer (man-made objects only).

```jsonc
{
  "id": "0_car",
  "name": "Car",
  "class_label": "car",          // car | container | wall | house | shelter
  "center":   [E, N, U],         // UTM metres (same frame as the cloud)
  "extent":   [L, W, H],         // box size in metres
  "rotation": [0, 0, qz, qw],    // quaternion — yaw about vertical only
  "avg_temperature": 13.4        // thermal/IR signature, °C
}
```

Counts: shelter 19 · house 15 · container 16 · wall 7 · car 1.
Temperature 9.8–25.4 °C (warm objects ⇒ possibly occupied / recently active).
Boxes are in the **same UTM frame** as the cloud — they register directly, no alignment needed.

> Note: terrain, roads and vegetation are **not** labeled. Those are derived from
> the cloud (see roadmap). The boxes are exactly the sightline occluders / cover
> elements Track 1 needs.
`````

## File: docs/challange.md
`````markdown
# Challenge — SE3 Labs Tactical AI (EDTH Munich)

A 3D reconstruction of a battlefield zone contains every answer an operator
needs — but can't surface them yet. Build the AI layer that extracts it.

SE3 Labs (Munich spatial-AI, TUM / Cremers lineage; product **SpatialGPT**) turn
live drone video into semantic 3D maps. The geometry is their moat; the
**tactical interpretation on top of it** is the value they don't have yet. This
is automated **Intelligence Preparation of the Battlefield (IPB)** — the terrain
analysis a trained officer does, in seconds, on a live 3D model.

## Two tracks (pick one / combine)

**Track 1 — Tactical Position Intelligence.** Where is the enemy likely to
approach from? Which position gives the best field of fire while staying
concealed? Where are the chokepoints, the dead ground, the key terrain? What
does the enemy see from that building, and where am I exposed?

> Insight: almost every Track-1 question reduces to **"what can be seen from
> where?"** — build the visibility/viewshed engine and the rest follow.
> *Cover* (stops bullets: walls, containers) ≠ *concealment* (hides only:
> vegetation). Approach routes = least-cost paths where cost = slope +
> traversability + **exposure to overwatch** (which loops back into visibility).

## Judging (EDTH)

1. Real problem?
2. Effective?
3. Original?
4. Deployable / mass-manufacturable?
5. Progress & drive **during** the event. → A working live demo beats slides; an honest "here's where it breaks" beats over-claiming. Output must be **operator-actionable in < 10 seconds**.

## Our direction

Lead with **Track 1**, built on one rigorous primitive: a viewshed / field-of-fire
engine on the true 3D surface (terrain from the cloud + the 58 object boxes as
occluders), in real UTM metres, with grid-reference output. Honest claim:
**surface-accurate multi-level visibility** that beats a flat bare-earth
heightmap — *not* volumetric X-ray 3D (the data is a ~4 pts/m² top-down surface).

Bonus single-pass intelligence we *can* do now: flag **thermal anomalies**
(occupied / recently-active structures) from `avg_temperature`.

The full Track-1 concept — placing a realistic Russian threat laydown and
computing the friendly course of action against it — is in
[THREAT_LIBRARY.md](THREAT_LIBRARY.md) (Red assets) and
[MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md) (Blue movement).
`````

## File: docs/data.md
`````markdown
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
`````

## File: docs/repo-context.md
`````markdown
This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where content has been compressed (code blocks are separated by ⋮---- delimiter).

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.github/
  dependabot.yml
data/
  README.md
docs/
  CHALLENGE.md
  DATA.md
  MANEUVER_ANALYSIS.md
  THREAT_LIBRARY.md
src/
  backend/
    scripts/
      inspect_ply.py
      prepare_web.py
      render_rasters.py
    __init__.py
    io.py
    README.md
  frontend/
    public/
      .gitkeep
    index.html
    README.md
  __init__.py
._point_cloud.ply
.gitignore
pyproject.toml
README.md
run.sh
```

# Files

## File: .github/dependabot.yml
````yaml
# .github/dependabot.yml

version: 2
updates:

  # Main rule for your Python dependencies
  - package-ecosystem: "pip"
    directory: "/" # Look for pyproject.toml in the root directory
    schedule:
      interval: "weekly"

    reviewers:
      - "patrickab"

    # Group related updates to reduce PR noise
    groups:
      streamlit-plugins:
        patterns:
          - "streamlit*"
          - "st-copy"
````

## File: data/README.md
````markdown
# Data

**The files in this folder are NOT committed** (see `.gitignore`). Get them from
the SE3 mentor and drop them here:

```
data/point_cloud.ply
data/bounding_boxes.json
```

## `point_cloud.ply`

Binary little-endian PLY, single `vertex` element, **3,986,862 points**.

| property | type | meaning |
|----------|------|---------|
| `x`, `y`, `z` | `double` | position in **UTM** (metres). `x`=easting, `y`=northing, `z`=elevation ASL |
| `red`, `green`, `blue` | `uchar` | photographic colour (real texture, *not* class codes) |

No normals, no per-point labels. Georeferenced; ~48.3°N (central Europe).
Scene ≈ **1264 × 775 m**, relief ≈ **32 m** (449.9–482.3 m ASL). ~4 pts/m².

## `bounding_boxes.json`

Array of **58 oriented 3D object boxes** — the semantic layer (man-made objects only).

```jsonc
{
  "id": "0_car",
  "name": "Car",
  "class_label": "car",          // car | container | wall | house | shelter
  "center":   [E, N, U],         // UTM metres (same frame as the cloud)
  "extent":   [L, W, H],         // box size in metres
  "rotation": [0, 0, qz, qw],    // quaternion — yaw about vertical only
  "avg_temperature": 13.4        // thermal/IR signature, °C
}
```

Counts: shelter 19 · house 15 · container 16 · wall 7 · car 1.
Temperature 9.8–25.4 °C (warm objects ⇒ possibly occupied / recently active).
Boxes are in the **same UTM frame** as the cloud — they register directly, no alignment needed.

> Note: terrain, roads and vegetation are **not** labeled. Those are derived from
> the cloud (see roadmap). The boxes are exactly the sightline occluders / cover
> elements Track 1 needs.
````

## File: docs/DATA.md
````markdown
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
````

## File: docs/MANEUVER_ANALYSIS.md
````markdown
# Maneuver Analysis — Blue (friendly) course of action

> Given the red laydown from [THREAT_LIBRARY.md](THREAT_LIBRARY.md), how should
> friendly forces move through this zone? This is the output an operator acts on:
> *where can I move unseen, where will I die, what must I kill first, do I go.*
> Everything here is computed from the 3D reconstruction + the threat envelopes —
> in real UTM metres, designed to read in **under 10 seconds**.

## The principle: observation gates lethality

Both fire modes collapse to one question — **can the enemy observe this ground?**
- **Direct fire:** a weapon with LOS to you, and you in range → you can be shot now.
- **Indirect fire:** *any* observer with LOS to you, you in range, kill-chain closes (~3 min with a recon UAV) → you can be shelled.

So the spine of the analysis is the **viewshed** — computed from every red sensor —
and weapon ranges layered on top. Build that one primitive well and every output
below falls out of it.

---

## The computed layers (each a raster over the zone)

Inputs: terrain surface + the 58 object boxes (occluders / cover) + derived
vegetation (concealment) + the red `enemy_assets.json`.

1. **Combined enemy observation map** `O(x)` — union of every red sensor's viewshed
   (snipers, tank/IFV optics, ground OPs, recon UAV). "Where am I seen, and by how
   many." The most important layer; it gates everything else.
2. **Direct-fire lethality** `D(x)` — per direct-fire weapon: `viewshed ∩ range[min,max] ∩ arc`, combined. "Where can I be shot directly," with which weapon.
3. **Indirect-fire coverage** `I(x)` — union of indirect range fans, **weighted by `O(x)`** and kill-chain time. Inside artillery range *and* observed = high; in range but unobserved (defilade from all observers) = low. "Where can I be shelled if seen."
4. **Cover** `C(x)` — hard cover from the boxes (walls, containers, houses stop fire) + terrain defilade. "What stops bullets here."
5. **Concealment** `K(x)` — vegetation (derived from the cloud) hides from view but not fire. "What hides me here." *Cover ≠ concealment — kept separate on purpose.*
6. **Traversability** `T(x)` — slope + surface class. "Can I physically move here / how fast."

### Composite risk surface
```
risk(x) = w_o·O(x) + w_d·D(x) + w_i·I(x)·observed(x) − w_c·C(x) − w_k·K(x)
```
Direct fire dominates where it reaches (instant, precise); observation+indirect
dominates the deep area; cover and concealment subtract risk. Weights are tuned to
what the sponsor/operators call "significant" (an open question for the mentor).

---

## Movement: the least-cost approach

Approach routes are **not** an ML prediction — they're terrain-logic optimisation
(like routing around traffic), which is *better* here: deterministic, explainable,
no training data needed. Find the cheapest path from line-of-departure to objective:

```
cost(step) = distance
           + α·exposure_to_observation        ← time spent in O(x)
           + β·direct_fire_lethality           ← D(x) along the step
           + γ·indirect_risk                   ← I(x)
           + δ·traversability_penalty          ← slope / bad surface
           − concealment_credit                ← moving through K(x)
```

The genuinely hard, interesting part is **defining `exposure`** — and it loops
straight back into the viewshed engine. That coupling is where the real
intelligence lives. The route-finder itself (Dijkstra / A* on the cost raster) is a
solved primitive. Output favours **dead ground, defilade, concealed corridors,
and the lee of buildings** — the path a good NCO would pick, with the reasons made explicit.

---

## What the operator gets (the actionable outputs)

1. **Covered approach axis** — the recommended route, drawn on the 3D view, with the % of it that is unseen vs exposed, and *where* the exposed stretches are.
2. **Bound / overwatch plan** — along the route, where to bound cover-to-cover and which friendly **support-by-fire** positions can overwatch each bound (bounding overwatch: the overwatch element must stay within supporting range of the bounding one).
3. **Suppression priority (HVT list)** — rank the red assets by how much of *your* approach they dominate. The tank that observes 60% of your axis outranks the sniper covering a corner. For each: *what to suppress, and the friendly position(s) from which you can engage it while staying concealed* (field-of-fire ∧ concealment for blue — the mirror of the red analysis).
4. **Dead-ground / assembly areas** — terrain hidden from all red observers: where to mass, form up, or treat casualties safely.
5. **Chokepoints** — where viable routes funnel (and where red expects you). Flag to avoid or to seize/clear first.
6. **Obscuration cue** — where a sightline can't be avoided, mark *where smoke* breaks the critical observation so the bound is survivable.
7. **The call** — **GO / NO-GO / GO-WITH-CONDITIONS**, e.g. *"Go: covered axis along the eastern treeline, 85% concealed; suppress the tank at grid …; smoke the 70 m open stretch at grid …; assembly in dead ground behind building 36."*

All of it in **UTM / MGRS grid references and metres** — operators think in grids, and it costs us nothing because the data is georeferenced.

---

## A single-pass bonus: thermal cueing

`avg_temperature` in `bounding_boxes.json` lets us flag **which structures are
warm** (occupied / recently active) — a hint about *where the red assets actually
are* before we even template them. Hot building ⇒ raise its likelihood of hosting
an OP/weapon. This recovers a "live scene intelligence" angle from a single pass.

---

## Maps to our build

| Layer | Source | Status |
|-------|--------|--------|
| terrain surface, slope | point cloud | next |
| occluders / hard cover | the 58 boxes | have |
| concealment (vegetation) | derived from cloud RGB+geometry | next |
| viewshed engine | terrain + boxes | **core to build** |
| `O/D/I` threat maps | viewshed + `enemy_assets.json` | after engine |
| route + COA outputs | cost raster + A* | after maps |

Backend modules to add live in [`src/backend/README.md`](../src/backend/README.md):
`terrain.py → visibility.py → fields.py → routes.py`.

## Honest limits (say these to the jury)

- The cloud is **~4 pts/m², top-down** → rich **2.5D surface**, not volumetric.
  We claim **surface-accurate multi-level visibility** (viewshed over real
  roofs/walls/canopy, which beats a flat bare-earth heightmap) — *not* see-through
  walls or building interiors.
- Engagement envelopes are **doctrinal models**, not ballistics — they bound the
  reasoning, they don't simulate a shell.
- Red positions are **templated/suspected** unless cued (e.g. by thermal); we label
  confidence and never present a guess as a confirmed contact.
- One temporal pass → no change detection; movement of red assets isn't tracked.

## Sources
- [Fire and movement](https://en.wikipedia.org/wiki/Fire_and_movement) · [Bounding overwatch](https://en.wikipedia.org/wiki/Bounding_overwatch) · [Enfilade and defilade / dead ground](https://en.wikipedia.org/wiki/Enfilade_and_defilade)
- [FM 34-130 IPB](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3 IPB (situation template, avenues of approach, COA)](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
- [Russia's reconnaissance-strike kill chain, Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
````

## File: docs/THREAT_LIBRARY.md
````markdown
# Threat Library — Red (OPFOR) asset model

> Scenario context for Track 1. We place a realistic **Russian threat laydown**
> into the reconstructed zone — each asset with its own observation and weapon
> envelope — then compute how friendly (Ukrainian / NATO) forces should maneuver
> against it. This is the **situation-template** step of Intelligence Preparation
> of the Battlefield (IPB, FM 34-130 / ATP 2-01.3): put the enemy where the
> terrain favours them, then reason about it.

Specs below are approximate, vary by variant/ammunition, and are sourced (see
end). They are used as **engagement-envelope parameters**, not exact ballistics —
good enough to drive terrain-grounded tactical reasoning, honest about being a
model.

---

## The one distinction that organises everything: how the kill happens

Every red asset kills you in one of three ways, and the terrain math differs for each:

| Mode | Needs line of sight? | Defeated by | Examples |
|------|----------------------|-------------|----------|
| **Direct fire** | **Yes** — the shooter must see you | dead ground, defilade, cover, breaking LOS | sniper, tank gun, ATGM, IFV autocannon, MG |
| **Indirect fire** | **No** — arcs over terrain | *not* terrain masking; only by denying **observation** (concealment, speed, smoke) and by range | mortar, howitzer, MLRS |
| **Observation / enabling** | **Yes** (it's a sensor) | counter-recon, EW, staying unseen | recon UAV, forward observer, EW |

**The master variable is observation.** Direct fire = *a weapon* sees you and you're in range. Indirect fire = *any observer* sees you, you're in range, and the kill chain closes in time. So the core computed product (see [MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md)) is the **combined enemy observation map** — the union of every red sensor's viewshed — with weapon range envelopes layered on top. Our viewshed engine is the heart of both red threat assessment and blue planning.

---

## Asset cards

Each card gives the real-world numbers and the **model parameters** we drive the
analysis with. `obs` = what it can *see* (sensor); `wpn` = what it can *kill*
(weapon). Ranges in metres.

### Sniper / Designated Marksman — `sniper`
- **Real:** SVD Dragunov 7.62×54 effective ~800 practical, ~1,200–1,300 max; precision rifles (Orsis T-5000) ~1,000–1,500; anti-materiel OSV-96 12.7 mm ~2,000 (defeats vehicles/optics).
- **obs:** optical/thermal, **arc ~ limited (~120° sector)** from a hide, range ≈ weapon range. **wpn:** direct, min ~100, eff ~800, max ~1,300 (AMR ~2,000), arc = sector.
- **Signature:** very low (the hardest to find). **Emplacement here:** upper floors of the tall houses (`36_house` 16 m, `24_house` 9 m) overlooking open approaches; treelines.
- **Threat character:** denies a corridor to dismounts; the viewshed *is* the threat. Defeated by dead ground / breaking LOS.

### Main Battle Tank — `tank`  (T-72 / T-80 / T-90)
- **Real:** 2A46M 125 mm — KE direct fire effective ~2,000–3,000, FCS to ~4,000–5,000; gun-launched ATGM 9M119 Refleks 100–5,000 (penetrates armour to 4 km). Coax 7.62 (~1,000), 12.7 AA MG (~1,500–2,000). Good thermal sights (day/night, multi-km).
- **obs:** thermal+optical, **360°**, range ~4,000. **wpn:** direct, min ~100, eff ~2,500, max ~5,000 (ATGM), **360°** turret.
- **Signature:** high (thermal/acoustic/visual), mobile (tracked). **Emplacement here:** hull-down behind walls/buildings or on roads with fields of fire down the long approach corridors; reverse-slope to ambush.
- **Vulnerabilities:** top-attack, ATGM, defilade; large dead zones close-in and behind masks.

### ATGM team — `atgm`  (Kornet 9M133)
- **Real:** base 5.0–5.5 km; Kornet-M ~8 km; FM-3 HE ~10 km; min ~100 m. Laser beam-rider, direct LOS, anti-armour (also bunkers/buildings).
- **obs:** optical/thermal sight, sector ~360° (repositionable), range ≈ weapon. **wpn:** direct, min ~150, eff ~4,000, max ~5,500 (–10,000), arc = sector.
- **Signature:** low until it fires (then laser/launch signature). **Emplacement here:** flanks/overwatch with long sightlines covering armour avenues; building edges.
- **Threat character:** dominant vs vehicles on any open, observed corridor. Defeated by masking LOS and by suppressing the team.

### Infantry Fighting Vehicle — `ifv`  (BMP-2/3)
- **Real:** 2A42 30 mm — vs light armour ~1,500, vs soft targets ~4,000, air to ~2,000–2,500; plus ATGM (Konkurs/Kornet). Optical/thermal sights.
- **obs:** thermal+optical, 360°, range ~3,000. **wpn:** direct, eff ~2,000, max ~4,000, 360°.
- **Signature:** high, mobile. **Emplacement:** overwatch of approaches, mutual support with tanks; carries dismounts.

### Mortar — `mortar`  (2S12 Sani 120 mm)
- **Real:** max ~7.1 km. High-angle **indirect** — arcs over terrain. Organic to infantry, responsive.
- **obs:** none of its own (needs a forward observer). **wpn:** **indirect**, min ~0.5 km, max ~7,100, **360°**, area effect.
- **Signature:** acoustic on firing; usually in defilade. **Emplacement here:** reverse slope / behind the building mass, unseen.
- **Threat character:** kills you anywhere within 7 km **if an observer sees you** — terrain won't hide you, breaking observation will.

### Towed / SP Howitzer — `howitzer`  (D-30 122 mm; 2S19 Msta 152 mm)
- **Real:** D-30 ~15.3 km (21.9 km RAP); 2S19 Msta-S ~24–30 km (40 km RAP / Krasnopol precision). Indirect.
- **obs:** none of its own. **wpn:** indirect, max 15,000–30,000+, 360° (or wide arc), area / precision.
- **Threat character:** the whole zone is inside its fan. Lethality gated entirely by **observation + kill-chain time**, not terrain.

### MLRS — `mlrs`  (BM-21 Grad 122 mm; BM-30 Smerch 300 mm)
- **Real:** Grad ~20 km (–40 km), 40-rocket saturation; Smerch ~70–90 km (–120 km). Indirect, area.
- **wpn:** indirect, max 20,000–90,000, area saturation. **Threat character:** punishes massing / assembly in the open; argues for dispersion and speed.

### Reconnaissance UAV — `uav_recon`  (Orlan-10)  ← the kill-chain enabler
- **Real:** loiters 1,000–1,500 m altitude, optical/IR/EW sensors, ~18 h endurance; **cues artillery to fire within ~3 min** of spotting a target (vs ~20 min without). EW variant jams GPS/comms; jamming-resistant.
- **obs:** **wide-area, top-down**, effectively sees most of the open zone; this is what makes *every indirect weapon* lethal. **wpn:** none (it spots; the guns shoot).
- **Threat character:** **this node turns "in range" into "in danger."** Suppressing/defeating observation (this drone + ground OPs) is the single highest-leverage blue action. Ties directly to SE3's **GNSS-denied** context — both sides fight blind/jammed.

### Electronic Warfare — `ew`  (optional)
- Jams GPS/comms — degrades our own recon drones and navigation. Note it as a constraint on the *blue* ISR that produced this 3D map, not a direct-fire threat.

---

## Data schema — `data/enemy_assets.json` (proposed)

Same UTM frame as the cloud and `bounding_boxes.json`, so red assets drop straight
into the viewer and the analysis. Drives both the engagement envelopes and the
viewsheds.

```jsonc
{
  "id": "red_01_tank",
  "class_label": "tank",            // sniper|tank|atgm|ifv|mortar|howitzer|mlrs|uav_recon|ew
  "side": "OPFOR",
  "position": [E, N, U],            // UTM metres; U includes sensor/muzzle height AGL
  "facing_deg": 135,                // primary orientation (matters for arc-limited assets)
  "obs": { "sensor": "thermal+optical", "range_m": 4000, "arc_deg": 360, "height_agl_m": 2.5 },
  "wpn": { "fire_type": "direct",   // direct | indirect
           "system": "2A46M 125mm + 9M119",
           "min_range_m": 100, "eff_range_m": 2500, "max_range_m": 5000, "arc_deg": 360 },
  "signature": { "thermal": "high", "acoustic": "high", "visual": "high" },
  "mobility": "tracked",
  "confidence": "suspected"         // confirmed | suspected | templated
}
```

## Where red would actually sit on THIS terrain (auto-placement logic)

Don't scatter assets randomly — emplace them where doctrine + terrain say they'd
be, reusing the layers we already compute:
- **Snipers / OPs** → highest-viewshed points (tall buildings, ridge) that dominate the open approaches.
- **Tanks / ATGM** → positions with long fields of fire down the armour avenues, ideally hull-down behind walls/buildings (use the 58 boxes as hull-down masks).
- **Mortars / artillery** → **reverse-slope / defilade** behind the building mass and the ridge — unseen, indirect.
- **Recon UAV** → overhead, near-global observation of open ground.

This makes the red laydown defensible to a jury ("you placed them where I would")
and lets us generate **enemy most-likely / most-dangerous COAs** automatically.

---

## Sources
- [T-90 / 2A46M & 9M119 Refleks (Wikipedia)](https://en.wikipedia.org/wiki/T-90) · [9M119 Svir/Refleks](https://en.wikipedia.org/wiki/9M119_Svir/Refleks) · [T-90 (GlobalSecurity)](https://www.globalsecurity.org/military/world/russia/t-90.htm)
- [SVD / sniper ranges (24/7 Wall St.)](https://247wallst.com/special-report/2024/04/11/the-russian-militarys-longest-range-firearms/) · [Orsis T-5000](https://247wallst.com/military/2025/10/17/russian-special-forces-add-the-orsis-t-5000-rifle-for-longer-range-operations/)
- [9M133 Kornet (Wikipedia)](https://en.wikipedia.org/wiki/9M133_Kornet) · [Kornet-M](https://en.wikipedia.org/wiki/9M133M_Kornet-M)
- [BMP-2 / 2A42 30 mm (Wikipedia)](https://en.wikipedia.org/wiki/Shipunov_2A42)
- [D-30 122 mm](https://en.wikipedia.org/wiki/122_mm_howitzer_2A18_(D-30)) · [2S19 Msta-S](https://en.wikipedia.org/wiki/2S19_Msta-S) · [BM-21 Grad](https://en.wikipedia.org/wiki/BM-21_Grad) · [BM-30 Smerch](https://en.wikipedia.org/wiki/BM-30_Smerch) · [2S12 Sani](https://en.wikipedia.org/wiki/2S12_Sani)
- [Orlan-10 (Wikipedia)](https://en.wikipedia.org/wiki/STC_Orlan-10) · [Russia's kill chain in Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
- [FM 34-130 Intelligence Preparation of the Battlefield](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
````

## File: src/backend/scripts/inspect_ply.py
````python
"""Print structure and statistics of the point cloud — sanity check the data.

    uv run python src/backend/scripts/inspect_ply.py [path/to/cloud.ply]
"""
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
⋮----
def main() -> None
⋮----
path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "point_cloud.ply"
v = read_ply(path)
⋮----
a = np.asarray(v[ax])
⋮----
n = v.shape[0]
idx = np.random.default_rng(0).choice(n, size=min(200_000, n), replace=False)
⋮----
uniq = np.unique((r << 16) | (g << 8) | b).size
⋮----
z = np.asarray(v["z"])
pct = np.percentile(z, [0, 1, 5, 50, 95, 99, 100]).round(2)
````

## File: src/backend/scripts/prepare_web.py
````python
"""Pack the point cloud for the three.js viewer.

Voxel-downsamples the ~4M-point cloud for smooth rendering, recenters to a local
origin (UTM values exceed float32 precision, so the browser must use a local
frame), and writes a compact binary + metadata into the frontend's public dir.
The bounding boxes are copied across unchanged.

    uv run python src/backend/scripts/prepare_web.py [--voxel 0.3] [--max-points 1400000]
"""
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
PUBLIC = ROOT / "src" / "frontend" / "public"
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Pack the point cloud for the web viewer")
⋮----
args = ap.parse_args()
⋮----
v = read_ply(args.ply)
⋮----
# one point per occupied voxel -> uniform-looking downsample
vi = ((x - ox) / args.voxel).astype(np.uint64)
vj = ((y - oy) / args.voxel).astype(np.uint64)
vk = ((z - oz) / args.voxel).astype(np.uint64)
⋮----
sel = np.sort(np.random.default_rng(0).choice(sel, args.max_points, replace=False))
⋮----
pos = np.empty((sel.size, 3), np.float32)
⋮----
col = np.empty((sel.size, 3), np.uint8)
⋮----
meta = {
````

## File: src/backend/scripts/render_rasters.py
````python
"""Rasterize the cloud to 2D analysis layers (ortho / DSM / height-above-ground).

Quick top-down views for understanding the scene and debugging. Output PNGs go to
``docs/figures/`` (gitignored — they are derived imagery of the data).

    uv run python src/backend/scripts/render_rasters.py [--res 0.5]
"""
⋮----
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
OUT = ROOT / "docs" / "figures"
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Rasterize the cloud to 2D layers")
⋮----
args = ap.parse_args()
⋮----
v = read_ply(args.ply)
⋮----
w = int(np.ceil((x.max() - x0) / args.res))
h = int(np.ceil((y.max() - y0) / args.res))
ix = np.clip(((x - x0) / args.res).astype(np.int64), 0, w - 1)
iy = h - 1 - np.clip(((y - y0) / args.res).astype(np.int64), 0, h - 1)  # north up
cell = iy * w + ix
order = np.argsort(z, kind="stable")  # last write per cell = highest point
⋮----
# top-down ortho (colour of highest point per cell)
rgb = np.zeros((w * h, 3), np.uint8)
⋮----
# digital surface model (max height per cell)
dsm = np.full(w * h, np.nan)
⋮----
def _save(img: np.ndarray, title: str, cmap: str, path: Path) -> None
⋮----
im = ax.imshow(img, cmap=cmap)
````

## File: src/backend/__init__.py
````python

````

## File: src/backend/io.py
````python
"""PLY reader for the SE3 reconnaissance point cloud.

Supports binary-little-endian PLY with a single ``vertex`` element (the format
SE3 ships). Returns a numpy structured array memory-mapped from disk, so even
the ~4M-point cloud loads instantly without copying it into RAM.
"""
⋮----
# PLY type name -> numpy type code
_PLY_DTYPE: dict[str, str] = {
⋮----
def read_ply(path: str | Path) -> np.ndarray
⋮----
"""Memory-map a binary-little-endian PLY and return its vertex array.

    Access columns by name, e.g. ``v["x"]``, ``v["red"]``. The dtype is built
    from the header, so extra properties (normals, labels) are picked up
    automatically if SE3 add them later.
    """
path = Path(path)
⋮----
raw = fh.read(8192)
⋮----
header_end = raw.index(b"\n", raw.index(b"end_header")) + 1
fields: list[tuple[str, str]] = []
count = 0
⋮----
parts = line.split()
⋮----
count = int(parts[2])
⋮----
dtype = np.dtype(fields)
````

## File: src/backend/README.md
````markdown
# Backend

Python data IO, processing, and (incoming) tactical-analysis code.

- `io.py` — zero-copy PLY reader (`read_ply` → numpy structured memmap).
- `scripts/` — runnable tools:
  - `inspect_ply.py` — print header + statistics (sanity-check the data)
  - `prepare_web.py` — downsample + pack the cloud for the viewer
  - `render_rasters.py` — top-down ortho / DSM layers (→ `docs/figures/`)

## Setup

```bash
uv sync                  # installs numpy, matplotlib, pillow
uv run python src/backend/scripts/inspect_ply.py
```

## Roadmap (tactical layer goes here)

Track-1 analysis modules to add next, all sharing one visibility primitive:

- `terrain.py` — derive ground surface + vegetation mask from the cloud
- `visibility.py` — viewshed / line-of-sight on terrain + the 58 object occluders
- `fields.py` — field-of-fire score, exposure / concealment map, dead ground
- `routes.py` — least-cost approach paths (slope + traversability + exposure)

Keep outputs operator-actionable: a ranked answer + a clear visual, in UTM grid
references, in < 10 s.
````

## File: src/frontend/public/.gitkeep
````

````

## File: src/frontend/index.html
````html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SE3 Tactical — Point Cloud + Objects</title>
<style>
  html,body{margin:0;height:100%;background:#0b0e13;color:#cfd8e3;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;overflow:hidden}
  #c{position:fixed;inset:0;display:block}
  .panel{position:fixed;background:rgba(10,14,20,.85);border:1px solid #243042;border-radius:10px;padding:11px 13px;backdrop-filter:blur(6px)}
  #hud{top:12px;left:12px;min-width:232px}
  #hud h1{margin:0 0 8px;font-size:12px;letter-spacing:.4px;color:#7fd1ff;font-weight:600}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0}
  .row label{color:#9fb0c3}
  input[type=range]{width:118px}
  button{background:#16202e;color:#cfe3ff;border:1px solid #2c3a4f;border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit}
  button:hover{background:#1d2a3c}
  .seg button{margin-right:4px}
  .seg button.on{background:#1f6feb;border-color:#1f6feb;color:#fff}
  #stat{margin-top:8px;color:#6b7c91;font-size:11px;border-top:1px solid #243042;padding-top:8px}
  #legend{top:12px;right:12px;min-width:170px}
  #legend h2{margin:0 0 7px;font-size:11px;color:#9fb0c3;font-weight:600;letter-spacing:.3px}
  .lg{display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;user-select:none}
  .sw{width:12px;height:12px;border-radius:3px;flex:0 0 auto;border:1px solid #00000055}
  .lg.off{opacity:.35}
  .lg .ct{margin-left:auto;color:#6b7c91}
  #info{bottom:12px;right:12px;min-width:210px;display:none}
  #info h3{margin:0 0 6px;font-size:12px;color:#7fd1ff}
  #info table{width:100%;border-collapse:collapse}
  #info td{padding:2px 0;color:#9fb0c3}
  #info td.v{color:#dfe9f4;text-align:right}
  #help{position:fixed;bottom:12px;left:12px;color:#5d6e82;font-size:11px}
  #load{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;color:#7fd1ff}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="load">loading scene…</div>

<div id="hud" class="panel" style="display:none">
  <h1>SE3 ZONE · 1264 × 775 m · 1:1</h1>
  <div class="row"><label>points</label>
    <span class="seg"><button id="bRGB" class="on">RGB</button><button id="bHGT">height</button></span></div>
  <div class="row"><label>objects</label>
    <span class="seg"><button id="bCLS" class="on">class</button><button id="bTHM">thermal</button></span></div>
  <div class="row"><label>point size</label><input id="psz" type="range" min="0.3" max="4" step="0.1" value="1.2"></div>
  <div class="row"><label>box fill</label><input id="opf" type="range" min="0" max="0.5" step="0.02" value="0.14"></div>
  <div class="row"><label><input type="checkbox" id="cEdges" checked> edges</label>
    <label><input type="checkbox" id="cPts" checked> cloud</label></div>
  <div class="row"><button id="top">top-down</button><button id="obl">oblique</button><button id="reset">reset</button></div>
  <div id="stat"></div>
</div>

<div id="legend" class="panel" style="display:none"><h2>OBJECTS · 58</h2><div id="lglist"></div>
  <div id="thermbar" style="display:none;margin-top:8px;font-size:10px;color:#6b7c91">thermal 9.8 → 25.4 °C</div></div>

<div id="info" class="panel"><h3 id="iName">—</h3><table id="iTab"></table></div>

<div id="help">drag = orbit · scroll = zoom · right-drag = pan · click a box = details</div>

<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
}}
</script>
<script type="module">
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// ---- load data ----
const meta = await (await fetch('public/meta.json')).json();
const boxes = await (await fetch('public/bounding_boxes.json')).json();
const N = meta.n, [sx,sy,sz] = meta.span, [ox,oy,oz] = meta.origin;
const buf = await (await fetch('public/cloud.bin')).arrayBuffer();
const pos = new Float32Array(buf, 0, N*3);
const rgb = new Uint8Array(buf, N*3*4, N*3);

// scene centre in UTM (so geometry sits around the origin, TRUE 1:1 scale)
const ESC = ox + sx/2, NSC = oy + sy/2, USC = oz + sz/2;
const W2V = (E,Nn,U)=>[E-ESC, U-USC, -(Nn-NSC)];   // east->X, up->Y, north->-Z

// ---- point cloud (no vertical exaggeration) ----
const positions = new Float32Array(N*3); const heights=new Float32Array(N);
let zmin=1e9,zmax=-1e9;
for(let i=0;i<N;i++){
  const e=pos[i*3],n=pos[i*3+1],u=pos[i*3+2];
  positions[i*3]=e-(sx/2); positions[i*3+1]=u-(sz/2); positions[i*3+2]=-(n-(sy/2));
  heights[i]=u; if(u<zmin)zmin=u; if(u>zmax)zmax=u;
}
const colRGB=new Float32Array(N*3); for(let i=0;i<N*3;i++) colRGB[i]=rgb[i]/255;
function turbo(t){t=Math.min(1,Math.max(0,t));
  const r=Math.max(0,Math.min(1,(34.61+t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05)))))/255));
  const g=Math.max(0,Math.min(1,(23.31+t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56)))))/255));
  const b=Math.max(0,Math.min(1,(27.2+t*(3211.1-t*(15327.97-t*(27814-t*(22569.18-t*6838.66)))))/255));
  return [r,g,b];}
const colHGT=new Float32Array(N*3);
for(let i=0;i<N;i++){const c=turbo((heights[i]-zmin)/(zmax-zmin));colHGT[i*3]=c[0];colHGT[i*3+1]=c[1];colHGT[i*3+2]=c[2];}

const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
geo.setAttribute('color',new THREE.BufferAttribute(colRGB.slice(),3));

const renderer=new THREE.WebGLRenderer({canvas:c,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b0e13);
const cam=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.5,12000);
const mat=new THREE.PointsMaterial({size:1.2,vertexColors:true,sizeAttenuation:true});
const cloud=new THREE.Points(geo,mat); scene.add(cloud);
const grid=new THREE.GridHelper(Math.max(sx,sy),Math.round(Math.max(sx,sy)/100),0x223044,0x141d29);
grid.position.y=-sz/2; scene.add(grid);
// north arrow (north = -Z)
scene.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(-sx/2+30,-sz/2,sy/2-30),90,0x4488ff,28,16));

// ---- objects (oriented boxes, true scale) ----
const CLASS_COL={car:0xff4d4d,container:0xffa033,wall:0xffe14d,house:0x4dd2ff,shelter:0x6bff8f};
const temps=boxes.map(b=>b.avg_temperature); const tmin=Math.min(...temps),tmax=Math.max(...temps);
const thermCol=t=>{const c=turbo((t-tmin)/(tmax-tmin));return (Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255);};
const boxGroup=new THREE.Group(); scene.add(boxGroup);
const fills=[]; const visClass={};
for(const b of boxes){
  const [E,Nn,U]=b.center, [lx,ly,lz]=b.extent;
  const qz=b.rotation[2], qw=b.rotation[3]; const yaw=2*Math.atan2(qz,qw);
  const g=new THREE.BoxGeometry(lx,lz,ly);         // X=E-len, Y=up-height, Z=N-width
  const col=CLASS_COL[b.class_label]??0xffffff;
  const fm=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.14,depthWrite:false,side:THREE.DoubleSide});
  const m=new THREE.Mesh(g,fm);
  const [vx,vy,vz]=W2V(E,Nn,U); m.position.set(vx,vy,vz); m.rotation.y=yaw;
  const ed=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:col}));
  m.add(ed); m.userData={box:b,baseCol:col,edge:ed};
  boxGroup.add(m); fills.push(m);
}

// ---- camera / controls ----
const ctrl=new OrbitControls(cam,renderer.domElement); ctrl.enableDamping=true; ctrl.dampingFactor=0.08;
const D=Math.max(sx,sy);
const obl=()=>{cam.position.set(0,D*0.55,D*0.85);ctrl.target.set(0,0,0);ctrl.update();};
const top=()=>{cam.position.set(0,D*1.15,0.01);ctrl.target.set(0,0,0);ctrl.update();};
obl();

// ---- UI ----
const $=id=>document.getElementById(id);
$('psz').oninput=e=>mat.size=+e.target.value;
$('opf').oninput=e=>fills.forEach(m=>m.material.opacity=+e.target.value);
$('cEdges').onchange=e=>fills.forEach(m=>m.userData.edge.visible=e.target.checked);
$('cPts').onchange=e=>cloud.visible=e.target.checked;
$('top').onclick=top; $('obl').onclick=obl; $('reset').onclick=obl;
function setPtCol(a,w){geo.setAttribute('color',new THREE.BufferAttribute(a,3));geo.attributes.color.needsUpdate=true;
  $('bRGB').classList.toggle('on',w==='rgb');$('bHGT').classList.toggle('on',w==='hgt');}
$('bRGB').onclick=()=>setPtCol(colRGB.slice(),'rgb'); $('bHGT').onclick=()=>setPtCol(colHGT.slice(),'hgt');
function boxColorMode(mode){
  $('bCLS').classList.toggle('on',mode==='cls');$('bTHM').classList.toggle('on',mode==='thm');
  $('thermbar').style.display=mode==='thm'?'block':'none';
  fills.forEach(m=>{const b=m.userData.box;const col=mode==='thm'?thermCol(b.avg_temperature):m.userData.baseCol;
    m.material.color.setHex(col);m.userData.edge.material.color.setHex(col);});
}
$('bCLS').onclick=()=>boxColorMode('cls'); $('bTHM').onclick=()=>boxColorMode('thm');

// legend with per-class toggle
const counts={}; boxes.forEach(b=>counts[b.class_label]=(counts[b.class_label]||0)+1);
const order=['shelter','house','container','wall','car'];
$('lglist').innerHTML=order.map(k=>`<div class="lg" data-k="${k}"><span class="sw" style="background:#${CLASS_COL[k].toString(16).padStart(6,'0')}"></span>${k}<span class="ct">${counts[k]||0}</span></div>`).join('');
order.forEach(k=>visClass[k]=true);
document.querySelectorAll('.lg').forEach(el=>el.onclick=()=>{const k=el.dataset.k;visClass[k]=!visClass[k];
  el.classList.toggle('off',!visClass[k]);
  fills.forEach(m=>{if(m.userData.box.class_label===k)m.visible=visClass[k];});});

// click to inspect
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let sel=null;
renderer.domElement.addEventListener('click',ev=>{
  ndc.x=(ev.clientX/innerWidth)*2-1; ndc.y=-(ev.clientY/innerHeight)*2+1;
  ray.setFromCamera(ndc,cam);
  const hit=ray.intersectObjects(fills,false);
  if(sel){sel.userData.edge.material.color.setHex(curHex(sel));sel.material.opacity=+$('opf').value;sel=null;}
  if(hit.length){sel=hit[0].object; sel.userData.edge.material.color.setHex(0xffffff); sel.material.opacity=Math.max(0.3,+$('opf').value);
    const b=sel.userData.box;
    $('iName').textContent=b.name+'  ('+b.id+')';
    $('iTab').innerHTML=
      `<tr><td>class</td><td class="v">${b.class_label}</td></tr>`+
      `<tr><td>size L×W×H</td><td class="v">${b.extent.map(x=>x.toFixed(1)).join(' × ')} m</td></tr>`+
      `<tr><td>temperature</td><td class="v">${b.avg_temperature.toFixed(1)} °C</td></tr>`+
      `<tr><td>yaw</td><td class="v">${(2*Math.atan2(b.rotation[2],b.rotation[3])*180/Math.PI).toFixed(0)}°</td></tr>`+
      `<tr><td>UTM E</td><td class="v">${b.center[0].toFixed(1)}</td></tr>`+
      `<tr><td>UTM N</td><td class="v">${b.center[1].toFixed(1)}</td></tr>`+
      `<tr><td>elev</td><td class="v">${b.center[2].toFixed(1)} m</td></tr>`;
    $('info').style.display='block';
  } else { $('info').style.display='none'; }
});
function curHex(m){const b=m.userData.box;return $('bTHM').classList.contains('on')?thermCol(b.avg_temperature):m.userData.baseCol;}

$('load').style.display='none'; $('hud').style.display='block'; $('legend').style.display='block';
$('stat').innerHTML=`pts ${N.toLocaleString()} · objects 58<br>UTM origin ${ox.toFixed(0)} E ${oy.toFixed(0)} N<br>relief ${sz.toFixed(1)} m · grid 100 m · N→arrow`;

addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
(function loop(){requestAnimationFrame(loop);ctrl.update();renderer.render(scene,cam);})();
</script>
</body>
</html>
````

## File: src/frontend/README.md
````markdown
# Frontend — 3D viewer

Interactive viewer for the point cloud + semantic object boxes. Static
`index.html` (three.js via CDN) — no build step.

## Run

```bash
# from repo root: build assets, then serve
./run.sh prep            # writes public/cloud.bin, meta.json, bounding_boxes.json
./run.sh serve           # http://localhost:8011

# or directly:
cd src/frontend && python3 -m http.server 8011
```

`public/` is generated (gitignored). It must exist before serving — run
`./run.sh prep` after dropping the data into `data/`.

## Controls

- **drag** orbit · **scroll** zoom · **right-drag** pan · **click a box** → details
- **points:** RGB / height-coloured · **objects:** colour by class / by thermal
- per-class show/hide (legend), point size, box-fill opacity, edges/cloud toggles
- true 1:1 scale (no vertical exaggeration), 100 m grid, north arrow

## Notes

- Coordinates are recentered to a local origin in `meta.json` (UTM doubles
  exceed float32 precision; the browser works in metres from that origin).
- Frame mapping: east → X, elevation → Y (up), north → −Z.
- three.js is loaded from a CDN, so the browser needs internet on first load.
````

## File: src/__init__.py
````python

````

## File: .gitignore
````
# ---- provided data (large / sensitive — get from the SE3 mentor, never commit) ----
data/*.ply
data/*.json
data/*.pcd
data/*.las
data/*.laz
data/*.bag
data/**/*.ply
data/**/*.json

# ---- generated web assets (rebuild: ./run.sh prep) ----
src/frontend/public/*
!src/frontend/public/.gitkeep

# ---- rendered figures / screenshots (derived from the data — keep out of git) ----
docs/figures/
*.png
*.jpg

# ---- python / uv ----
.venv/
venv/
__pycache__/
*.pyc
.ruff_cache/
.pytest_cache/
*.egg-info/
build/
dist/
uv.lock

# ---- tooling / editor / os ----
.claude/
.playwright-mcp/
.DS_Store
__MACOSX/
.vscode/
.idea/
````

## File: docs/CHALLENGE.md
````markdown
# Challenge — SE3 Labs Tactical AI (EDTH Munich)

A 3D reconstruction of a battlefield zone contains every answer an operator
needs — but can't surface them yet. Build the AI layer that extracts it.

SE3 Labs (Munich spatial-AI, TUM / Cremers lineage; product **SpatialGPT**) turn
live drone video into semantic 3D maps. The geometry is their moat; the
**tactical interpretation on top of it** is the value they don't have yet. This
is automated **Intelligence Preparation of the Battlefield (IPB)** — the terrain
analysis a trained officer does, in seconds, on a live 3D model.

## Two tracks (pick one / combine)

**Track 1 — Tactical Position Intelligence.** Where is the enemy likely to
approach from? Which position gives the best field of fire while staying
concealed? Where are the chokepoints, the dead ground, the key terrain? What
does the enemy see from that building, and where am I exposed?

> Insight: almost every Track-1 question reduces to **"what can be seen from
> where?"** — build the visibility/viewshed engine and the rest follow.
> *Cover* (stops bullets: walls, containers) ≠ *concealment* (hides only:
> vegetation). Approach routes = least-cost paths where cost = slope +
> traversability + **exposure to overwatch** (which loops back into visibility).

**Track 2 — Live Scene Intelligence.** Two passes hours apart: find what changed
and ignore what didn't. Real change is **geometry** (vehicle moved, earth dug);
noise is **appearance** (shadow, sway, lighting). *Requires a second pass — see
DATA.md; we currently have one.*

## Judging (EDTH)

1. Real problem? 2. Effective? 3. Original? 4. Deployable / mass-manufacturable?
5. Progress & drive **during** the event. → A working live demo beats slides; an
honest "here's where it breaks" beats over-claiming. Output must be
**operator-actionable in < 10 seconds**.

## Our direction

Lead with **Track 1**, built on one rigorous primitive: a viewshed / field-of-fire
engine on the true 3D surface (terrain from the cloud + the 58 object boxes as
occluders), in real UTM metres, with grid-reference output. Honest claim:
**surface-accurate multi-level visibility** that beats a flat bare-earth
heightmap — *not* volumetric X-ray 3D (the data is a ~4 pts/m² top-down surface).

Bonus single-pass intelligence we *can* do now: flag **thermal anomalies**
(occupied / recently-active structures) from `avg_temperature`.

The full Track-1 concept — placing a realistic Russian threat laydown and
computing the friendly course of action against it — is in
[THREAT_LIBRARY.md](THREAT_LIBRARY.md) (Red assets) and
[MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md) (Blue movement).

Open questions for the mentor; the two that gate everything: *is there a second
pass?* and *what does a "good" < 10 s output look like to you?*
````

## File: pyproject.toml
````toml
[project]
name = "se3-reconnaissance"
version = "0.1.0"
description = "Tactical AI layer on SE3's 3D battlefield reconstruction (EDTH Munich)"
requires-python = ">=3.12"
dependencies = [
    "numpy>=2.0",
    "matplotlib>=3.8",
    "pillow>=10.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]

[tool.hatch.metadata]
allow-direct-references = true

[tool.ruff]
target-version = "py312"
respect-gitignore = true
line-length = 135

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "F",   # pyflakes
  "I",   # isort
  "B",   # bugbear
  "C4",  # comprehensions
  "TCH", # type-checking hygiene
  "SIM", # simplify
  "ANN", # type hints
  "ARG", # unused arguments
  "RUF"  # Ruff-native rules
]
ignore = [
  "RUF100",
  "B904"
]

[tool.ruff.lint.isort]
force-sort-within-sections = true
section-order = ["standard-library", "third-party", "first-party", "local-folder"]

# Enables Ruff formatter with default options (Black-compatible)
[tool.ruff.format]
````

## File: README.md
````markdown
# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction: turn labeled geometry into the
> judgments an operator needs — *where is the enemy likely to approach, where do
> I have field of fire, where am I exposed* — fast and legible.

Docs:
- [`docs/CHALLENGE.md`](docs/CHALLENGE.md) — the challenge brief & our direction
- [`docs/DATA.md`](docs/DATA.md) — exactly what's in the dataset (inspected, not assumed)
- [`docs/THREAT_LIBRARY.md`](docs/THREAT_LIBRARY.md) — Red (OPFOR) asset model: per-system observation + weapon envelopes
- [`docs/MANEUVER_ANALYSIS.md`](docs/MANEUVER_ANALYSIS.md) — Blue course of action: threat maps, covered approach, suppression priority, go/no-go

## Repo layout

```
.
├── data/                 # provided inputs — gitignored (get from the SE3 mentor)
│   ├── point_cloud.ply   #   ~4M-point cloud, XYZ (UTM, metres) + RGB
│   └── bounding_boxes.json#   58 oriented object boxes + thermal signature
├── src/
│   ├── backend/          # Python: data IO + processing + (soon) tactical analysis
│   │   ├── io.py         #   PLY reader (memmap, zero-copy)
│   │   └── scripts/      #   runnable tools (inspect / prepare web / render)
│   └── frontend/         # interactive 3D viewer (three.js, static)
│       ├── index.html
│       └── public/       #   generated assets — gitignored (./run.sh prep)
├── docs/                 # challenge brief + data findings
├── pyproject.toml        # uv / hatchling project (ruff configured)
└── run.sh                # ./run.sh prep | serve
```

## Quickstart

```bash
# 1. install python deps (uv)
uv sync

# 2. put the provided files in data/  (not in git)
#    data/point_cloud.ply
#    data/bounding_boxes.json

# 3. build the web viewer assets from the cloud
./run.sh prep            # downsample + pack -> src/frontend/public/

# 4. serve the 3D viewer
./run.sh serve           # http://localhost:8011
```

Then open <http://localhost:8011>. Inspect the raw cloud any time with:

```bash
uv run python src/backend/scripts/inspect_ply.py
```

## The viewer

True 1:1 scale (no vertical exaggeration). Point cloud (RGB / height-coloured)
with all 58 oriented object boxes overlaid — colour by **class** or by
**thermal** signature, per-class show/hide, click any box for its
dimensions / temperature / UTM position. North arrow + 100 m grid for scale.

## Status / roadmap

We model a realistic **Russian threat laydown** and compute how friendly forces
maneuver against it. The spine is one primitive — the **viewshed** — because
observation gates lethality (direct fire: a weapon sees you; indirect fire: an
observer sees you). See the two tactical docs above.

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [x] Tactical concept: threat library (Red) + maneuver analysis (Blue)
- [ ] Derived terrain surface + vegetation layer from the cloud (cover vs concealment)
- [ ] **Viewshed / line-of-sight engine** (terrain + the 58 box occluders) — core
- [ ] `data/enemy_assets.json` schema + place Red assets in the viewer
- [ ] Threat maps: combined observation `O`, direct-fire `D`, indirect `I`
- [ ] Approach-route cost surface → covered axis, bounds, chokepoints, dead ground
- [ ] Suppression priority (HVT) + go/no-go callout, in MGRS, < 10 s
- [ ] Enemy-perspective viewshed (drop a pin → what they see & threaten)

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh prep` after you drop the data in.
````

## File: run.sh
````bash
#!/bin/sh
# Dev helper.
#   ./run.sh prep    build viewer assets from data/ -> src/frontend/public/
#   ./run.sh serve   serve the 3D viewer at http://localhost:8011  (default)
set -e
cd "$(dirname "$0")"

case "${1:-serve}" in
  prep)
    shift
    uv run python src/backend/scripts/prepare_web.py "$@"
    ;;
  serve)
    echo "viewer -> http://localhost:8011  (Ctrl-C to stop)"
    cd src/frontend && python3 -m http.server 8011
    ;;
  *)
    echo "usage: ./run.sh [prep|serve]" >&2
    exit 1
    ;;
esac
````
`````

## File: docs/THREAT_LIBRARY.md
`````markdown
# Threat Library — Red (OPFOR) asset model

> Scenario context for Track 1. We place a realistic **Russian threat laydown**
> into the reconstructed zone — each asset with its own observation and weapon
> envelope — then compute how friendly (Ukrainian / NATO) forces should maneuver
> against it. This is the **situation-template** step of Intelligence Preparation
> of the Battlefield (IPB, FM 34-130 / ATP 2-01.3): put the enemy where the
> terrain favours them, then reason about it.

Specs below are approximate, vary by variant/ammunition, and are sourced (see
end). They are used as **engagement-envelope parameters**, not exact ballistics —
good enough to drive terrain-grounded tactical reasoning, honest about being a
model.

---

## The one distinction that organises everything: how the kill happens

Every red asset kills you in one of three ways, and the terrain math differs for each:

| Mode | Needs line of sight? | Defeated by | Examples |
|------|----------------------|-------------|----------|
| **Direct fire** | **Yes** — the shooter must see you | dead ground, defilade, cover, breaking LOS | sniper, tank gun, ATGM, IFV autocannon, MG |
| **Indirect fire** | **No** — arcs over terrain | *not* terrain masking; only by denying **observation** (concealment, speed, smoke) and by range | mortar, howitzer, MLRS |
| **Observation / enabling** | **Yes** (it's a sensor) | counter-recon, EW, staying unseen | recon UAV, forward observer, EW |

**The master variable is observation.** Direct fire = *a weapon* sees you and you're in range. Indirect fire = *any observer* sees you, you're in range, and the kill chain closes in time. So the core computed product (see [MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md)) is the **combined enemy observation map** — the union of every red sensor's viewshed — with weapon range envelopes layered on top. Our viewshed engine is the heart of both red threat assessment and blue planning.

---

## Asset cards

Each card gives the real-world numbers and the **model parameters** we drive the
analysis with. `obs` = what it can *see* (sensor); `wpn` = what it can *kill*
(weapon). Ranges in metres.

### Sniper / Designated Marksman — `sniper`
- **Real:** SVD Dragunov 7.62×54 effective ~800 practical, ~1,200–1,300 max; precision rifles (Orsis T-5000) ~1,000–1,500; anti-materiel OSV-96 12.7 mm ~2,000 (defeats vehicles/optics).
- **obs:** optical/thermal, **arc ~ limited (~120° sector)** from a hide, range ≈ weapon range. **wpn:** direct, min ~100, eff ~800, max ~1,300 (AMR ~2,000), arc = sector.
- **Signature:** very low (the hardest to find). **Emplacement here:** upper floors of the tall houses (`36_house` 16 m, `24_house` 9 m) overlooking open approaches; treelines.
- **Threat character:** denies a corridor to dismounts; the viewshed *is* the threat. Defeated by dead ground / breaking LOS.

### Main Battle Tank — `tank`  (T-72 / T-80 / T-90)
- **Real:** 2A46M 125 mm — KE direct fire effective ~2,000–3,000, FCS to ~4,000–5,000; gun-launched ATGM 9M119 Refleks 100–5,000 (penetrates armour to 4 km). Coax 7.62 (~1,000), 12.7 AA MG (~1,500–2,000). Good thermal sights (day/night, multi-km).
- **obs:** thermal+optical, **360°**, range ~4,000. **wpn:** direct, min ~100, eff ~2,500, max ~5,000 (ATGM), **360°** turret.
- **Signature:** high (thermal/acoustic/visual), mobile (tracked). **Emplacement here:** hull-down behind walls/buildings or on roads with fields of fire down the long approach corridors; reverse-slope to ambush.
- **Vulnerabilities:** top-attack, ATGM, defilade; large dead zones close-in and behind masks.

### ATGM team — `atgm`  (Kornet 9M133)
- **Real:** base 5.0–5.5 km; Kornet-M ~8 km; FM-3 HE ~10 km; min ~100 m. Laser beam-rider, direct LOS, anti-armour (also bunkers/buildings).
- **obs:** optical/thermal sight, sector ~360° (repositionable), range ≈ weapon. **wpn:** direct, min ~150, eff ~4,000, max ~5,500 (–10,000), arc = sector.
- **Signature:** low until it fires (then laser/launch signature). **Emplacement here:** flanks/overwatch with long sightlines covering armour avenues; building edges.
- **Threat character:** dominant vs vehicles on any open, observed corridor. Defeated by masking LOS and by suppressing the team.

### Infantry Fighting Vehicle — `ifv`  (BMP-2/3)
- **Real:** 2A42 30 mm — vs light armour ~1,500, vs soft targets ~4,000, air to ~2,000–2,500; plus ATGM (Konkurs/Kornet). Optical/thermal sights.
- **obs:** thermal+optical, 360°, range ~3,000. **wpn:** direct, eff ~2,000, max ~4,000, 360°.
- **Signature:** high, mobile. **Emplacement:** overwatch of approaches, mutual support with tanks; carries dismounts.

### Mortar — `mortar`  (2S12 Sani 120 mm)
- **Real:** max ~7.1 km. High-angle **indirect** — arcs over terrain. Organic to infantry, responsive.
- **obs:** none of its own (needs a forward observer). **wpn:** **indirect**, min ~0.5 km, max ~7,100, **360°**, area effect.
- **Signature:** acoustic on firing; usually in defilade. **Emplacement here:** reverse slope / behind the building mass, unseen.
- **Threat character:** kills you anywhere within 7 km **if an observer sees you** — terrain won't hide you, breaking observation will.

### Towed / SP Howitzer — `howitzer`  (D-30 122 mm; 2S19 Msta 152 mm)
- **Real:** D-30 ~15.3 km (21.9 km RAP); 2S19 Msta-S ~24–30 km (40 km RAP / Krasnopol precision). Indirect.
- **obs:** none of its own. **wpn:** indirect, max 15,000–30,000+, 360° (or wide arc), area / precision.
- **Threat character:** the whole zone is inside its fan. Lethality gated entirely by **observation + kill-chain time**, not terrain.

### MLRS — `mlrs`  (BM-21 Grad 122 mm; BM-30 Smerch 300 mm)
- **Real:** Grad ~20 km (–40 km), 40-rocket saturation; Smerch ~70–90 km (–120 km). Indirect, area.
- **wpn:** indirect, max 20,000–90,000, area saturation. **Threat character:** punishes massing / assembly in the open; argues for dispersion and speed.

### Reconnaissance UAV — `uav_recon`  (Orlan-10)  ← the kill-chain enabler
- **Real:** loiters 1,000–1,500 m altitude, optical/IR/EW sensors, ~18 h endurance; **cues artillery to fire within ~3 min** of spotting a target (vs ~20 min without). EW variant jams GPS/comms; jamming-resistant.
- **obs:** **wide-area, top-down**, effectively sees most of the open zone; this is what makes *every indirect weapon* lethal. **wpn:** none (it spots; the guns shoot).
- **Threat character:** **this node turns "in range" into "in danger."** Suppressing/defeating observation (this drone + ground OPs) is the single highest-leverage blue action. Ties directly to SE3's **GNSS-denied** context — both sides fight blind/jammed.

### Electronic Warfare — `ew`  (optional)
- Jams GPS/comms — degrades our own recon drones and navigation. Note it as a constraint on the *blue* ISR that produced this 3D map, not a direct-fire threat.

---

## Data schema — `data/enemy_assets.json` (proposed)

Same UTM frame as the cloud and `bounding_boxes.json`, so red assets drop straight
into the viewer and the analysis. Drives both the engagement envelopes and the
viewsheds.

```jsonc
{
  "id": "red_01_tank",
  "class_label": "tank",            // sniper|tank|atgm|ifv|mortar|howitzer|mlrs|uav_recon|ew
  "side": "OPFOR",
  "position": [E, N, U],            // UTM metres; U includes sensor/muzzle height AGL
  "facing_deg": 135,                // primary orientation (matters for arc-limited assets)
  "obs": { "sensor": "thermal+optical", "range_m": 4000, "arc_deg": 360, "height_agl_m": 2.5 },
  "wpn": { "fire_type": "direct",   // direct | indirect
           "system": "2A46M 125mm + 9M119",
           "min_range_m": 100, "eff_range_m": 2500, "max_range_m": 5000, "arc_deg": 360 },
  "signature": { "thermal": "high", "acoustic": "high", "visual": "high" },
  "mobility": "tracked",
  "confidence": "suspected"         // confirmed | suspected | templated
}
```

## Where red would actually sit on THIS terrain (auto-placement logic)

Don't scatter assets randomly — emplace them where doctrine + terrain say they'd
be, reusing the layers we already compute:
- **Snipers / OPs** → highest-viewshed points (tall buildings, ridge) that dominate the open approaches.
- **Tanks / ATGM** → positions with long fields of fire down the armour avenues, ideally hull-down behind walls/buildings (use the 58 boxes as hull-down masks).
- **Mortars / artillery** → **reverse-slope / defilade** behind the building mass and the ridge — unseen, indirect.
- **Recon UAV** → overhead, near-global observation of open ground.

This makes the red laydown defensible to a jury ("you placed them where I would")
and lets us generate **enemy most-likely / most-dangerous COAs** automatically.

---

## Sources
- [T-90 / 2A46M & 9M119 Refleks (Wikipedia)](https://en.wikipedia.org/wiki/T-90) · [9M119 Svir/Refleks](https://en.wikipedia.org/wiki/9M119_Svir/Refleks) · [T-90 (GlobalSecurity)](https://www.globalsecurity.org/military/world/russia/t-90.htm)
- [SVD / sniper ranges (24/7 Wall St.)](https://247wallst.com/special-report/2024/04/11/the-russian-militarys-longest-range-firearms/) · [Orsis T-5000](https://247wallst.com/military/2025/10/17/russian-special-forces-add-the-orsis-t-5000-rifle-for-longer-range-operations/)
- [9M133 Kornet (Wikipedia)](https://en.wikipedia.org/wiki/9M133_Kornet) · [Kornet-M](https://en.wikipedia.org/wiki/9M133M_Kornet-M)
- [BMP-2 / 2A42 30 mm (Wikipedia)](https://en.wikipedia.org/wiki/Shipunov_2A42)
- [D-30 122 mm](https://en.wikipedia.org/wiki/122_mm_howitzer_2A18_(D-30)) · [2S19 Msta-S](https://en.wikipedia.org/wiki/2S19_Msta-S) · [BM-21 Grad](https://en.wikipedia.org/wiki/BM-21_Grad) · [BM-30 Smerch](https://en.wikipedia.org/wiki/BM-30_Smerch) · [2S12 Sani](https://en.wikipedia.org/wiki/2S12_Sani)
- [Orlan-10 (Wikipedia)](https://en.wikipedia.org/wiki/STC_Orlan-10) · [Russia's kill chain in Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
- [FM 34-130 Intelligence Preparation of the Battlefield](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
`````

## File: src/backend/scripts/inspect_ply.py
`````python
"""Print structure and statistics of the point cloud — sanity check the data.

    uv run python src/backend/scripts/inspect_ply.py [path/to/cloud.ply]
"""
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
⋮----
def main() -> None
⋮----
path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "point_cloud.ply"
v = read_ply(path)
⋮----
a = np.asarray(v[ax])
⋮----
n = v.shape[0]
idx = np.random.default_rng(0).choice(n, size=min(200_000, n), replace=False)
⋮----
uniq = np.unique((r << 16) | (g << 8) | b).size
⋮----
z = np.asarray(v["z"])
pct = np.percentile(z, [0, 1, 5, 50, 95, 99, 100]).round(2)
`````

## File: src/backend/__init__.py
`````python

`````

## File: src/backend/io.py
`````python
"""PLY reader for the SE3 reconnaissance point cloud.

Supports binary-little-endian PLY with a single ``vertex`` element (the format
SE3 ships). Returns a numpy structured array memory-mapped from disk, so even
the ~4M-point cloud loads instantly without copying it into RAM.
"""
⋮----
# PLY type name -> numpy type code
_PLY_DTYPE: dict[str, str] = {
⋮----
def read_ply(path: str | Path) -> np.ndarray
⋮----
"""Memory-map a binary-little-endian PLY and return its vertex array.

    Access columns by name, e.g. ``v["x"]``, ``v["red"]``. The dtype is built
    from the header, so extra properties (normals, labels) are picked up
    automatically if SE3 add them later.
    """
path = Path(path)
⋮----
raw = fh.read(8192)
⋮----
header_end = raw.index(b"\n", raw.index(b"end_header")) + 1
fields: list[tuple[str, str]] = []
count = 0
⋮----
parts = line.split()
⋮----
count = int(parts[2])
⋮----
dtype = np.dtype(fields)
`````

## File: src/backend/terrain.py
`````python
"""Terrain layer — build a Digital Surface Model (DSM) from the point cloud.

The DSM is the height grid every visibility computation runs on. We also stamp the
58 oriented object boxes into it as solid occluders, so buildings/walls block
line-of-sight even where the cloud is sparse. Output is a georeferenced GeoTIFF
(UTM) — the authoritative, reusable layer — plus the arrays in memory.

    uv run python src/backend/terrain.py [--res 1.0]
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
BUILD = ROOT / "build"
# UTM zone is unconfirmed (looks like 32N / Bavaria) — analysis uses only the
# metric transform, so the EPSG is a label, overridable with --epsg.
DEFAULT_EPSG = 32632
⋮----
def box_yaw(box: dict) -> float
⋮----
"""Yaw (rad) from the [0,0,qz,qw] quaternion."""
⋮----
def box_polygon(box: dict) -> Polygon
⋮----
"""Footprint of an oriented box as a world-coordinate (UTM) polygon."""
⋮----
local = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
⋮----
v = read_ply(ply_path)
⋮----
w = int(np.ceil((xmax - xmin) / res))
h = int(np.ceil((ymax - ymin) / res))
transform = from_origin(xmin, ymax, res, res)  # north-up
⋮----
col = np.clip(((x - xmin) / res).astype(np.int64), 0, w - 1)
row = np.clip(((ymax - y) / res).astype(np.int64), 0, h - 1)
flat = np.full(w * h, -np.inf)
order = np.argsort(z, kind="stable")            # last write per cell = highest point
⋮----
dsm = flat.reshape(h, w)
valid = np.isfinite(dsm)                          # cells with real cloud data
⋮----
n_boxes = 0
⋮----
boxes = json.loads(boxes_path.read_text())
shapes = [(box_polygon(b), b["center"][2] + b["extent"][2] / 2) for b in boxes]
tops = rasterize(shapes, out_shape=(h, w), transform=transform, fill=np.nan,
m = ~np.isnan(tops)
base = np.where(np.isnan(dsm), -np.inf, dsm)
dsm = np.where(m, np.maximum(base, tops), dsm)
n_boxes = len(boxes)
⋮----
dsm = _fill_gaps(dsm)
⋮----
def _fill_gaps(dsm: np.ndarray) -> np.ndarray
⋮----
nan = np.isnan(dsm)
⋮----
idx = distance_transform_edt(nan, return_distances=False, return_indices=True)
dsm = dsm[tuple(idx)]
⋮----
def world_to_pixel(transform: rasterio.Affine, x: float, y: float) -> tuple[int, int]
⋮----
nodata = np.nan if dtype.startswith("float") else 0
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Build the DSM from the point cloud")
⋮----
args = ap.parse_args()
⋮----
t = build_dsm(args.ply, args.res, args.boxes, args.epsg)
out = BUILD / "dsm.tif"
`````

## File: src/backend/units.py
`````python
"""Unit primitives — the shared contact model for all battlefield actors.

A :class:`Unit` is a static doctrinal type definition (sensor/weapon envelope).
A :class:`UnitContact` is a placed instance with position and intelligence quality
fields. :class:`PlaceUnitRequest` is the thin POST body; the backend fills in
doctrinal defaults from :data:`UNIT_CATALOG`.

The catalog is the **single source of truth** for per-type properties. Both the
analysis chain (``threat_template``, ``fields``) and the frontend (via
``GET /api/unit-profiles``) read from it; neither side keeps its own copy.
"""
⋮----
class Side(str, Enum)
⋮----
friendly = "friendly"
hostile  = "hostile"
unknown  = "unknown"
⋮----
class WeightClass(str, Enum)
⋮----
heavy  = "heavy"
medium = "medium"
light  = "light"
⋮----
class UnitType(str, Enum)
⋮----
tank    = "tank"
ifv     = "ifv"
apc     = "apc"
assault = "assault"
sniper  = "sniper"
mortar  = "mortar"
⋮----
class FireKind(str, Enum)
⋮----
"""How this unit delivers effect — gates which threat-field pass projects it."""
direct   = "direct"    # line-of-sight weapon (tank, IFV, sniper)
indirect = "indirect"  # indirect fire (mortar/howitzer)
observer = "observer"  # no organic fires; observation only
⋮----
class ThreatRole(str, Enum)
⋮----
"""Tactical role in the IPB fires-and-observation overlay."""
observer   = "observer"
anti_armor = "anti_armor"
indirect   = "indirect"
⋮----
class Source(str, Enum)
⋮----
visual    = "visual"
thermal   = "thermal"
reported  = "reported"
sigint    = "sigint"
templated = "templated"
⋮----
class PlaceUnitRequest(BaseModel)
⋮----
"""Thin POST body — backend fills doctrinal defaults from UNIT_CATALOG.

    The operator-side "template" placement is just a :class:`PlaceUnitRequest`
    with only ``side`` + ``unit_type`` + ``world`` + ``azimuth``; the backend
    resolves the catalog entry and returns a fully-populated :class:`UnitContact`.
    """
side:       Side
unit_type:  UnitType
world:      tuple[float, float, float]      # UTM (E, N, elevation_m)
azimuth:    float | None = None             # grid north, clockwise, degrees
velocity:   tuple[float, float] | None = None  # (east_m_s, north_m_s)
confidence: float = 0.5
source:     Source = Source.templated
⋮----
class UnitContact(BaseModel)
⋮----
"""Full contact record — persisted in backend, serialised to frontend as JSON."""
id:                str   = Field(default_factory=lambda: uuid.uuid4().hex[:8])
side:              Side
weight_class:      WeightClass
unit_type:         UnitType
label:             str                        # human-readable type label for the UI
role:              ThreatRole                # tactical role for the fires/observation overlay
fire_kind:         FireKind                  # how the unit delivers effect (gates fields.py projection)
world:             tuple[float, float, float]
confidence:        float
sec_since_contact: float
source:            Source
azimuth:           float | None
obs_arc:           float        # sector of observation, degrees, centred on azimuth
eff_range_m:       float        # effective observation / engagement range, m
max_range_m:       float        # maximum effective range (fades to ~0.2 P(hit) past eff_range_m)
height_agl_m:      float        # sensor/eye height above local terrain (AGL, not sea level)
velocity:          tuple[float, float] | None = None
⋮----
@dataclass
class Unit
⋮----
"""Static type definition — doctrinal sensor/weapon envelope.

    Not a contact; no position or intelligence fields.
    """
unit_type:    UnitType
weight_class: WeightClass
label:        str
role:         ThreatRole
fire_kind:    FireKind
obs_arc:      float           # sector of observation, degrees
eff_range_m:  float           # effective observation / engagement range, m
max_range_m:  float           # maximum range (fades past eff_range_m)
height_agl_m: float           # sensor/eye height above local terrain
⋮----
def new_contact(self, req: PlaceUnitRequest) -> UnitContact
⋮----
def to_profile(self) -> dict
⋮----
"""Lightweight dict for ``GET /api/unit-profiles`` — UI drag-preview needs
        only the keys it actually reads (range/arc/label)."""
⋮----
# Canonical doctrinal defaults.
#
# Field sources (reconciled against docs/THREAT_LIBRARY.md):
#  - obs_arc / eff_range_m / height_agl_m : previously in this catalog; kept.
#  - max_range_m / fire_kind / role       : previously duplicated in fields.PROFILES
#                                            and threat_template.{ARC,ROLE}; now here.
#  - mortar.eff_range_m != max_range_m    : eff ~ minimum-range buffer; max ~ charge table.
UNIT_CATALOG: dict[str, Unit] = {
⋮----
# indirect fire: sector-of-fire is meaningless, observer gating is handled by fields.py
⋮----
# Legacy alias used by the analyzed-threat template (docs/THREAT_LIBRARY.md).
# ``sniper_op`` was the historical key for an OP-positioned sniper; canonical
# type is ``sniper``. Resolving through this alias keeps the threat-template
# pipeline consistent with the unit catalog.
_ALIAS: dict[str, str] = {"sniper_op": "sniper"}
⋮----
def resolve_unit(key: str) -> Unit | None
⋮----
"""Resolve a catalog key or legacy alias (e.g. ``sniper_op``) to a :class:`Unit`."""
⋮----
def unit_profiles() -> list[dict]
⋮----
"""Catalog as a list of profile dicts — serialised by ``GET /api/unit-profiles``."""
`````

## File: src/frontend/src/components/InfoPanelPopup.tsx
`````typescript
import { ScreenPoint } from '../lib/types'
⋮----
interface Props {
  screen: ScreenPoint | null
  width?: number
  header: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}
⋮----
/**
 * Shared layout shell for all information popups anchored to a scene object.
 * Position is driven by `screen` — a projected world coordinate that updates
 * as the camera moves, keeping the popup spatially locked to its subject.
 * See .docs/conventions.md § Information Panel Popup for the full contract.
 */
export default function InfoPanelPopup(
⋮----
export function DataRow(
`````

## File: src/frontend/src/components/PlacedUnitPopup.tsx
`````typescript
import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
`````

## File: src/frontend/src/components/ThreatPanel.tsx
`````typescript
import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'
⋮----
/** Ranked list of likely enemy positions; visible in Threat color mode. */
export default function ThreatPanel()
`````

## File: src/frontend/src/main.tsx
`````typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
`````

## File: src/frontend/postcss.config.js
`````javascript

`````

## File: src/frontend/tsconfig.json
`````json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
`````

## File: src/frontend/vite.config.ts
`````typescript
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
⋮----
// Single source of truth, shared with the backend (src/config.json).
`````

## File: src/__init__.py
`````python

`````

## File: src/config.json
`````json
{
  "backend": { "host": "127.0.0.1", "port": 8011 },
  "frontend": { "port": 5173 },
  "cloud": { "voxel_m": 0.1, "max_points": 3900000 }
}
`````

## File: docs/architecture.md
`````markdown
# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). Turns labeled geometry into operator
judgments — *where is the enemy likely to approach, where do I have field of
fire, where am I exposed* — fast and legible.

## One-line system

Provided 3D data → Python ingest/processing → packed web assets → interactive
three.js viewer. The tactical layer is now being built on top: the **viewshed
engine (Slice 1) is done**; threat maps + routes come next.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided inputs, gitignored: point cloud + object boxes | given |
| **Backend** (`src/backend/`) | Python IO, raster/web prep scripts | built |
| **Frontend** (`src/frontend/`) | Static three.js 3D viewer, no build step | built |
| **Tactical layer** (`src/backend/`) | `terrain.py` + `visibility.py` (viewshed) | **Slice 1 built** |
| **Tactical layer** (`src/backend/`) | `fields.py` (threat maps) → `routes.py` | planned |

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

## Tactical layer

Spine = **one primitive, the viewshed**, because *observation gates
lethality*: direct fire = a weapon sees you & in range; indirect fire = any
observer sees you, in range, kill-chain closes. Build order (all share the
visibility primitive):

```
terrain.py    DSM from cloud + 58 boxes stamped as occluders   [BUILT, Slice 1]
   ↓          (vegetation mask for concealment still to add)
visibility.py viewshed / LOS on the DSM (eye/target ht, range, [BUILT, Slice 1]
   ↓          arc, facing)   ← core primitive
fields.py     O (combined observation), D (direct-fire), I (indirect),  [planned]
   ↓          cover C, concealment K, traversability T → composite risk
routes.py     least-cost approach (A*/Dijkstra on cost raster)          [planned]
              → covered axis, bounds, chokepoints, dead ground, HVT, go/no-go
```

### Viewshed engine (Slice 1, built)

- **`terrain.py`** → `build_dsm()`: max-height grid (default 1 m) from the cloud,
  with the 58 oriented boxes rasterized in as solid occluders (so walls/buildings
  block line of sight even where the cloud is sparse); gaps nearest-filled. Saved
  as a georeferenced **GeoTIFF** (`build/dsm.tif`, UTM).
- **`visibility.py`** → `viewshed()`: radial sweep from an observer; per ray it
  tracks the running-max terrain elevation angle and marks a cell visible when a
  standing target there clears everything closer. Parameters: eye height, target
  height, max range, arc, facing. Outputs `build/viewshed.tif` + a per-web-point
  `viewshed.bin`/`.json` overlay the viewer drapes (red = seen, green = dead
  ground), with the observer marker + range ring. Observer auto-placed at a
  realistic roof **edge** (not the centre of a large flat roof, which self-occludes).
- Inputs/outputs are georeferenced UTM (GeoTIFF) — reusable in QGIS / SE3's stack
  — plus a compact binary derived for the browser.

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
`````

## File: docs/conventions.md
`````markdown
# Conventions

## Stack

- **Python ≥ 3.12**, managed by **uv** (`uv sync`, `uv run python …`).
  Build backend: **hatchling**; package = `src`.
- Deps: `numpy>=2.0`, `matplotlib>=3.8`, `pillow>=10.0`, plus the geo stack for
  the tactical layer — `rasterio>=1.4` (GeoTIFF), `shapely>=2.0` (footprints),
  `scipy>=1.13` (gap-fill).
- **Frontend:** vanilla static HTML + **three.js@0.160** via CDN importmap.
  No bundler, no npm, no build step. Browser needs internet on first load.

## Lint / format — ruff (the only tool)

- `line-length = 135`, `target-version = py312`, formatter = Black-compatible.
- Lint select: `E F I B C4 TCH SIM ANN ARG RUF`. Ignored: `RUF100`, `B904`.
- `respect-gitignore = true`. isort: force-sort within sections, order
  stdlib → third-party → first-party → local.
- Type hints expected (`ANN`). Scripts use `# noqa: E402` for imports placed
  after the `sys.path`/ROOT bootstrap.

## Code style (observed)

- Scripts resolve repo root via `ROOT = Path(__file__).resolve().parents[3]`,
  then import `from src.backend.io import read_ply`.
- Each script: module docstring with a `uv run …` usage line, a `main()`,
  `argparse` for options.
- numpy-first, vectorized; zero-copy / memmap where the data is large.
- Comments are terse and explain *why* (e.g. why recenter to a local origin).

## Naming

- Python: `snake_case` files & funcs. Object class labels:
  `sniper|tank|atgm|ifv|mortar|howitzer|mlrs|uav_recon|ew`,
  box classes `car|container|wall|house|shelter`.
- Coordinates always **UTM metres**; outputs aim for UTM/MGRS grid refs.
- Frame convention in viewer: **E→X, U→Y (up), N→−Z**.

## Data discipline

- **Never commit data** — `data/*.{ply,json,pcd,las,laz,bag}` gitignored.
  Generated web assets (`src/frontend/public/*`), figures (`docs/figures/`,
  `*.png/*.jpg`), and `uv.lock` are gitignored too.
- Verify the data by parsing it; don't trust marketing claims (see `data.md`).

## Git / workflow

- Work on feature branches off `main`.
- **Agent never commits, pushes, or amends unless explicitly told to.**
- Dependabot: weekly pip updates, grouped (streamlit*), reviewer `patrickab`.

## Testing

No test suite yet. Sanity-check via `inspect_ply.py`. Keep tactical outputs
**operator-actionable in < 10 s** (a working demo over slides; honest "here's
where it breaks" over over-claiming).
`````

## File: docs/current-focus.md
`````markdown
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
`````

## File: docs/MANEUVER_ANALYSIS.md
`````markdown
# Maneuver Analysis — Blue (friendly) course of action

> Given the red laydown from [THREAT_LIBRARY.md](THREAT_LIBRARY.md), how should
> friendly forces move through this zone? This is the output an operator acts on:
> *where can I move unseen, where will I die, what must I kill first, do I go.*
> Everything here is computed from the 3D reconstruction + the threat envelopes —
> in real UTM metres, designed to read in **under 10 seconds**.

## The principle: observation gates lethality

Both fire modes collapse to one question — **can the enemy observe this ground?**
- **Direct fire:** a weapon with LOS to you, and you in range → you can be shot now.
- **Indirect fire:** *any* observer with LOS to you, you in range, kill-chain closes (~3 min with a recon UAV) → you can be shelled.

So the spine of the analysis is the **viewshed** — computed from every red sensor —
and weapon ranges layered on top. Build that one primitive well and every output
below falls out of it.

---

## The computed layers (each a raster over the zone)

Inputs: terrain surface + the 58 object boxes (occluders / cover) + derived
vegetation (concealment) + the red `enemy_assets.json`.

1. **Combined enemy observation map** `O(x)` — union of every red sensor's viewshed
   (snipers, tank/IFV optics, ground OPs, recon UAV). "Where am I seen, and by how
   many." The most important layer; it gates everything else.
2. **Direct-fire lethality** `D(x)` — per direct-fire weapon: `viewshed ∩ range[min,max] ∩ arc`, combined. "Where can I be shot directly," with which weapon.
3. **Indirect-fire coverage** `I(x)` — union of indirect range fans, **weighted by `O(x)`** and kill-chain time. Inside artillery range *and* observed = high; in range but unobserved (defilade from all observers) = low. "Where can I be shelled if seen."
4. **Cover** `C(x)` — hard cover from the boxes (walls, containers, houses stop fire) + terrain defilade. "What stops bullets here."
5. **Concealment** `K(x)` — vegetation (derived from the cloud) hides from view but not fire. "What hides me here." *Cover ≠ concealment — kept separate on purpose.*
6. **Traversability** `T(x)` — slope + surface class. "Can I physically move here / how fast."

### Composite risk surface
```
risk(x) = w_o·O(x) + w_d·D(x) + w_i·I(x)·observed(x) − w_c·C(x) − w_k·K(x)
```
Direct fire dominates where it reaches (instant, precise); observation+indirect
dominates the deep area; cover and concealment subtract risk. Weights are tuned to
what the sponsor/operators call "significant" (an open question for the mentor).

---

## Movement: the least-cost approach

Approach routes are **not** an ML prediction — they're terrain-logic optimisation
(like routing around traffic), which is *better* here: deterministic, explainable,
no training data needed. Find the cheapest path from line-of-departure to objective:

```
cost(step) = distance
           + α·exposure_to_observation        ← time spent in O(x)
           + β·direct_fire_lethality           ← D(x) along the step
           + γ·indirect_risk                   ← I(x)
           + δ·traversability_penalty          ← slope / bad surface
           − concealment_credit                ← moving through K(x)
```

The genuinely hard, interesting part is **defining `exposure`** — and it loops
straight back into the viewshed engine. That coupling is where the real
intelligence lives. The route-finder itself (Dijkstra / A* on the cost raster) is a
solved primitive. Output favours **dead ground, defilade, concealed corridors,
and the lee of buildings** — the path a good NCO would pick, with the reasons made explicit.

---

## What the operator gets (the actionable outputs)

1. **Covered approach axis** — the recommended route, drawn on the 3D view, with the % of it that is unseen vs exposed, and *where* the exposed stretches are.
2. **Bound / overwatch plan** — along the route, where to bound cover-to-cover and which friendly **support-by-fire** positions can overwatch each bound (bounding overwatch: the overwatch element must stay within supporting range of the bounding one).
3. **Suppression priority (HVT list)** — rank the red assets by how much of *your* approach they dominate. The tank that observes 60% of your axis outranks the sniper covering a corner. For each: *what to suppress, and the friendly position(s) from which you can engage it while staying concealed* (field-of-fire ∧ concealment for blue — the mirror of the red analysis).
4. **Dead-ground / assembly areas** — terrain hidden from all red observers: where to mass, form up, or treat casualties safely.
5. **Chokepoints** — where viable routes funnel (and where red expects you). Flag to avoid or to seize/clear first.
6. **Obscuration cue** — where a sightline can't be avoided, mark *where smoke* breaks the critical observation so the bound is survivable.
7. **The call** — **GO / NO-GO / GO-WITH-CONDITIONS**, e.g. *"Go: covered axis along the eastern treeline, 85% concealed; suppress the tank at grid …; smoke the 70 m open stretch at grid …; assembly in dead ground behind building 36."*

All of it in **UTM / MGRS grid references and metres** — operators think in grids, and it costs us nothing because the data is georeferenced.

---

## A single-pass bonus: thermal cueing

`avg_temperature` in `bounding_boxes.json` lets us flag **which structures are
warm** (occupied / recently active) — a hint about *where the red assets actually
are* before we even template them. Hot building ⇒ raise its likelihood of hosting
an OP/weapon. This recovers a "live scene intelligence" angle from a single pass.

---

## Maps to our build

| Layer | Source | Status |
|-------|--------|--------|
| terrain surface (DSM) | point cloud | **built** (`terrain.py`, Slice 1) |
| occluders / hard cover | the 58 boxes | **built** (stamped into DSM) |
| viewshed engine | DSM + boxes | **built** (`visibility.py`, Slice 1) |
| concealment (vegetation) | derived from cloud RGB+geometry | next |
| `O/D/I` threat maps | viewshed + `enemy_assets.json` | after `fields.py` |
| route + COA outputs | cost raster + A* | after maps |

Backend modules to add live in [`src/backend/README.md`](../src/backend/README.md):
`terrain.py → visibility.py → fields.py → routes.py`.

## Honest limits (say these to the jury)

- The cloud is **~4 pts/m², top-down** → rich **2.5D surface**, not volumetric.
  We claim **surface-accurate multi-level visibility** (viewshed over real
  roofs/walls/canopy, which beats a flat bare-earth heightmap) — *not* see-through
  walls or building interiors.
- Engagement envelopes are **doctrinal models**, not ballistics — they bound the
  reasoning, they don't simulate a shell.
- Red positions are **templated/suspected** unless cued (e.g. by thermal); we label
  confidence and never present a guess as a confirmed contact.
- One temporal pass → no change detection; movement of red assets isn't tracked.

## Sources
- [Fire and movement](https://en.wikipedia.org/wiki/Fire_and_movement) · [Bounding overwatch](https://en.wikipedia.org/wiki/Bounding_overwatch) · [Enfilade and defilade / dead ground](https://en.wikipedia.org/wiki/Enfilade_and_defilade)
- [FM 34-130 IPB](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3 IPB (situation template, avenues of approach, COA)](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
- [Russia's reconnaissance-strike kill chain, Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
`````

## File: docs/module-map.md
`````markdown
# Module Map

```
.
├── data/                    provided inputs — gitignored (get from SE3 mentor)
├── src/
│   ├── backend/             Python: IO, processing, tactical analysis
│   │   ├── io.py
│   │   ├── terrain.py       DSM + box occluders → GeoTIFF (Slice 1)
│   │   ├── visibility.py    viewshed / line-of-sight engine (Slice 1)
│   │   └── scripts/         runnable tools (inspect / prepare_web / render)
│   └── frontend/            static three.js 3D viewer
│       ├── index.html
│       └── public/          generated assets — gitignored (./run.sh prep)
├── build/                   generated GeoTIFFs (dsm.tif, viewshed.tif) — gitignored
├── docs/                    brief, data findings, tactical concept, agent context
├── .github/dependabot.yml   weekly pip updates, grouped
├── pyproject.toml           uv / hatchling project, ruff config
└── run.sh                   ./run.sh prep | serve
```

## Backend — `src/backend/`

| File | Responsibility |
|------|----------------|
| `io.py` | **Zero-copy PLY reader.** `read_ply(path) → numpy structured memmap`. Parses binary-LE header, builds dtype from it (extra props like normals/labels auto-detected). Access columns by name: `v["x"]`, `v["red"]`. ~4M points load instantly, no RAM copy. |
| `terrain.py` | **DSM builder (Slice 1).** `build_dsm()` → max-height grid (default 1 m) from the cloud, with the 58 oriented boxes stamped in as solid occluders, gaps nearest-filled. Saves georeferenced `build/dsm.tif`. Helpers: `box_polygon`, `world_to_pixel`, `save_geotiff`. `uv run python src/backend/terrain.py [--res 1.0]`. |
| `visibility.py` | **Viewshed engine (Slice 1, core).** `viewshed(dsm, …, obs, eye_h, target_h, range, arc, facing)` → radial line-of-sight on the DSM. Saves `build/viewshed.tif` + per-web-point `public/viewshed.{bin,json}` overlay; observer auto-placed at a realistic roof edge. `uv run python src/backend/visibility.py [--box 36_house] [--range 1200] [--arc 360]`. |
| `scripts/inspect_ply.py` | Print header + per-axis stats, colour uniqueness (200k sample), z percentiles. Data sanity check. `uv run python src/backend/scripts/inspect_ply.py [path]`. |
| `scripts/prepare_web.py` | Pack cloud for viewer: **voxel-downsample** (one point/occupied voxel), recenter to local origin, write `cloud.bin` + `meta.json` to `public/`; copy boxes across. `[--voxel 0.3] [--max-points 1400000]`. |
| `scripts/render_rasters.py` | Rasterize cloud to 2D layers (ortho / DSM / height-above-ground) → `docs/figures/` PNGs (gitignored). `[--res 0.5]`. Highest point per cell ("north up"). |

**Built (Slice 1):** `terrain.py` (DSM + occluders), `visibility.py` (viewshed/LOS).
**Planned (next, all share the viewshed):** vegetation mask in `terrain.py`,
`fields.py` (threat maps O/D/I, exposure/concealment, dead ground), `routes.py`
(least-cost approach paths), plus a FastAPI layer for live "drop a pin" viewsheds.
See `src/backend/README.md`.

## Frontend — `src/frontend/`

| File | Responsibility |
|------|----------------|
| `index.html` | **Entire viewer** — single static file, three.js@0.160 via CDN importmap, no build. Loads `public/{meta,bounding_boxes}.json` + `cloud.bin`; renders point cloud (RGB / turbo height / **viewshed**) + 58 oriented boxes (colour by class / thermal). **Viewshed mode** (red = seen / green = dead ground) reads `public/viewshed.{bin,json}` when present, with observer marker + range ring + readout. HUD controls, per-class legend toggle, raycast click-to-inspect, OrbitControls, 100 m grid, north arrow. True 1:1 scale. |
| `public/` | Generated assets (gitignored, only `.gitkeep` committed): `cloud.bin`, `meta.json`, `bounding_boxes.json`, and (after `visibility.py`) `viewshed.{bin,json}`. Run `./run.sh prep`. |

**Viewer internals:** `W2V(E,N,U)` maps UTM→view (E→X, U→Y, N→−Z); `turbo()`
colormap for height & thermal; `CLASS_COL` per-class palette; raycaster picks
box meshes → details table (size, temp, yaw, UTM E/N, elev).

## Data — `data/` (gitignored)

`point_cloud.ply` (~4M pts, XYZ UTM + RGB) and `bounding_boxes.json` (58
boxes + thermal). See `architecture.md` for full schema. `data/README.md`
documents the expected drop-in files. Boxes register directly onto the cloud
(shared UTM frame).

## Docs — `docs/`

| File | Content |
|------|---------|
| `challange.md` | EDTH/SE3 brief, two tracks (Track 1 chosen), judging, our direction. |
| `data.md` | What the files *actually* contain (parsed, not assumed) + implications. |
| `THREAT_LIBRARY.md` | Red (OPFOR) asset model: per-system obs + weapon envelopes, `enemy_assets.json` schema (proposed), auto-placement logic. |
| `MANEUVER_ANALYSIS.md` | Blue COA: computed layers (O/D/I/C/K/T), composite risk, least-cost routes, operator outputs, go/no-go. |
| `architecture.md` · `conventions.md` · `current-focus.md` · `module-map.md` | Agent/team context: system shape, coding conventions, status, this map. |
| `repo-context.md` | Generated full-repo dump (Repomix-style); regenerate rather than hand-edit. |

## Build / run — `run.sh`

`./run.sh prep` → builds viewer assets (runs `prepare_web.py`).
`./run.sh serve` (default) → `python3 -m http.server 8011` in `src/frontend`.
`````

## File: src/backend/README.md
`````markdown
# Backend

Python data IO, the API server, and the tactical-analysis layer.

- `io.py` — zero-copy PLY reader (`read_ply` → numpy structured memmap).
- `app.py` — FastAPI app: voxel-downsamples + packs the cloud on startup (in RAM,
  via `pack_cloud`), serves the viewer at `/` and `api/{meta,cloud,boxes}`, plus
  `api/viewshed{,-info}` when present. High-resolution default (0.1 m/voxel,
  ~3.9M points).
- `terrain.py` — build the DSM from the cloud, stamp the 58 boxes as occluders,
  save a georeferenced GeoTIFF (`build/dsm.tif`). The height grid everything runs on.
- `visibility.py` — radial line-of-sight viewshed from an observer. Writes
  `build/viewshed.{tif,bin,json}`; the `.bin/.json` use `pack_cloud`'s exact points
  so the per-point overlay aligns with what the viewer serves.
- `scripts/inspect_ply.py` — print header + statistics (sanity-check the data).

## Setup

```bash
uv sync                  # numpy · fastapi · uvicorn · rasterio · shapely · scipy
uv run python src/backend/visibility.py     # optional: build the viewshed overlay
./run.sh                 # serve at http://localhost:8011
uv run python src/backend/scripts/inspect_ply.py   # sanity-check the data
```

Generated layers land in `build/` (gitignored). The viewer's **viewshed** mode
lights up once `visibility.py` has run; otherwise that button stays disabled.

## Roadmap (tactical layer continues here)

Built so far: `terrain.py` (DSM) + `visibility.py` (viewshed). Next, all sharing
the visibility primitive:

- `fields.py` — field-of-fire score, exposure / concealment map, dead ground
- `routes.py` — least-cost approach paths (slope + traversability + exposure)

Keep outputs operator-actionable: a ranked answer + a clear visual, in UTM grid
references, in < 10 s.
`````

## File: src/frontend/src/components/Sidebar.tsx
`````typescript
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { ColorMode, LayerKey } from '../lib/types'
⋮----
export default function Sidebar()
⋮----
onChange=
`````

## File: src/frontend/src/components/ThreatPopup.tsx
`````typescript
import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
`````

## File: src/frontend/src/lib/colors.ts
`````typescript
// Object class → fill colour (tactical palette lives in tailwind.config.js).
⋮----
// Google Turbo colormap, t in [0,1] → [r,g,b] in [0,1].
export const TURBO = (t: number): [number, number, number] =>
⋮----
const c = (x: number)
`````

## File: src/frontend/src/lib/utils.ts
`````typescript
type V3 = [number, number, number]
⋮----
// World (UTM E, N, elev) → view space, recentred on the scene and y-up.
export function w2v(p: V3, origin: V3, span: V3): V3
⋮----
// View space → World (UTM E, N, elev), inverse of w2v().
export function v2w(p: V3, origin: V3, span: V3): V3
`````

## File: src/frontend/package.json
`````json
{
  "name": "se3-tactical-ui",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "milsymbol": "^3.0.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.160.0",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.160.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.6.0",
    "vite": "^5.2.0"
  }
}
`````

## File: src/backend/visibility.py
`````python
"""Visibility layer — line-of-sight viewshed on the DSM.

The core Track-1 primitive. From an observer position, compute every cell it can
see, accounting for real surface height + the box occluders (so a shooter on a
roof sees over a wall, and dead ground behind a building is correctly hidden).

Radial sweep: cast rays out to max range, track the running max terrain elevation
angle; a cell is visible if the angle to a standing target there clears everything
closer. This is surface-accurate 2.5D visibility — honestly not volumetric.

    uv run python src/backend/visibility.py [--box 36_house] [--range 1200] [--arc 360]

Outputs: build/viewshed.tif (georeferenced) + build/viewshed.{bin,json}
(per web-cloud-point seen/not flag + observer; served by the FastAPI app at
/api/viewshed{,-info} for the viewer overlay).
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.terrain import BUILD, DATA, build_dsm, save_geotiff, world_to_pixel  # noqa: E402
⋮----
orow = int(np.clip(orow, 0, h - 1))
ocol = int(np.clip(ocol, 0, w - 1))
⋮----
obs_z = float(dsm[orow, ocol])
eye = obs_z + eye_h
⋮----
vis = np.zeros((h, w), dtype=bool)
⋮----
rng_cells = int(max_range / res)
n_az = max(720, int(2 * np.pi * rng_cells))            # ~1-cell spacing at edge
half = np.deg2rad(arc_deg / 2)
centre = np.deg2rad(facing_deg)
⋮----
azimuths = np.linspace(0, 2 * np.pi, n_az, endpoint=False)
⋮----
azimuths = np.linspace(centre - half, centre + half, max(2, int(n_az * arc_deg / 360)))
t = np.arange(1, rng_cells + 1) * res
⋮----
xs = ox + np.cos(a) * t
ys = oy + np.sin(a) * t
cols = ((xs - transform.c) / transform.a).astype(np.int64)
rows = ((transform.f - ys) / (-transform.e)).astype(np.int64)
ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
⋮----
gh = dsm[rr, cc]
terr_ang = (gh - eye) / tt                          # blocking angle (terrain top)
tgt_ang = (gh + target_h - eye) / tt                # angle to a standing target
run = np.maximum.accumulate(terr_ang)
prev = np.empty_like(run)
⋮----
seen = tgt_ang >= prev
⋮----
boxes = json.loads(boxes_path.read_text())
⋮----
by_id = {b["id"]: b for b in boxes}
b = by_id.get(box_id) if box_id else max(
⋮----
boxes, key=lambda b: b["center"][2] + b["extent"][2] / 2)  # tallest = default OP
⋮----
top = cz + lz / 2
# Put the OP at the roof EDGE facing outward (away from the built-up centroid),
# not the centre — a real observer overlooks the approach, and the centre of a
# large flat roof occludes its own surrounding ground.
mx = sum(bb["center"][0] for bb in boxes) / len(boxes)
my = sum(bb["center"][1] for bb in boxes) / len(boxes)
⋮----
d = math.hypot(dx, dy) or 1.0
reach = 0.48 * max(lx, ly)
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Compute a viewshed from an observer")
⋮----
args = ap.parse_args()
⋮----
t = build_dsm(DATA / "point_cloud.ply", args.res, DATA / "bounding_boxes.json")
xy = (args.x, args.y) if args.x is not None and args.y is not None else None
⋮----
obs_z = (obs_top + args.eye) if obs_top is not None else None
⋮----
eye = (obs_top if obs_top is not None else float(t["dsm"][orow, ocol])) + args.eye
⋮----
# sample per web-cloud-point for the viewer overlay. Pack the exact same points
# the FastAPI viewer serves (same fn + defaults => identical indices, aligned overlay).
pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
meta = pack["meta"]
⋮----
n = meta["n"]
buf = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
wx = buf[:, 0] + ox
wy = buf[:, 1] + oy
tr = t["transform"]
cols = ((wx - tr.c) / tr.a).astype(np.int64)
rows = ((tr.f - wy) / (-tr.e)).astype(np.int64)
⋮----
flags = np.zeros(n, dtype=np.uint8)
⋮----
obs_eye_world = (obs_xy[0], obs_xy[1], eye)
info = {
⋮----
# recentred into the viewer's local frame (east->X, up->Y, north->-Z)
`````

## File: src/frontend/public/.gitkeep
`````

`````

## File: src/frontend/README.md
`````markdown
# SE3 Tactical Intelligence — Frontend

Modern React + Vite application for battlefield intelligence visualization.

## Stack

- **React 18** + **TypeScript** — component framework
- **Vite** — build tool (instant HMR, fast builds)
- **TresJS** → three.js — 3D scene
- **Radix UI** — accessible headless components
- **TailwindCSS** — styling, dark theme
- **Zustand** (ready to add) — global state

## Development

```bash
# Install deps
npm install

# Start dev server (HMR at localhost:5173, proxies /api to :8011)
npm run dev

# Build for production
npm run build

# Preview built app
npm run preview
```

## Architecture

```
src/
├── app/
│   ├── AppContent.tsx    (main layout)
│   └── layout.css
├── components/           (React components)
│   ├── SceneViewer.tsx   (three.js canvas)
│   ├── ControlPanel.tsx  (UI controls)
│   ├── ThreatPanel.tsx   (threat details)
│   └── LayerStack.tsx    (layer toggles)
├── contexts/            (React Context for state)
│   └── ViewerContext.tsx
├── hooks/               (custom hooks)
│   └── useScene.ts      (load scene data)
├── lib/
│   ├── api.ts           (FastAPI fetch calls)
│   ├── types.ts         (TypeScript interfaces)
│   ├── colors.ts        (tactical palette)
│   └── utils.ts         (helpers)
├── App.tsx              (root)
└── main.tsx             (entry)
```

## Features

- **Real-time 3D viewer** — point cloud + semantic boxes, true 1:1 scale
- **Multiple colormodes** — RGB / height / viewshed overlay
- **Layer toggles** — show/hide cloud, boxes, viewshed
- **Threat details** — click boxes to inspect
- **Keyboard shortcuts** — V=viewshed, L=layers, T=threats
- **Dark tactical UI** — command center aesthetic

## Next Steps

- [ ] TresJS integration (Vue wrapper, replace three.js direct calls)
- [ ] Keyboard handler hook (useKeyboard)
- [ ] Threat placement UI
- [ ] Route visualization
- [ ] Risk map heatmap overlay
- [ ] Go/No-Go readout panel

## Env

`VITE_API_URL` — FastAPI base URL (default: localhost:8011)
`````

## File: src/frontend/tailwind.config.js
`````javascript

`````

## File: src/backend/fields.py
`````python
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
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.app import MAX_POINTS, VOXEL, pack_cloud  # noqa: E402
from src.backend.terrain import BUILD, DATA, box_polygon, build_dsm, save_geotiff  # noqa: E402
from src.backend.units import resolve_unit  # noqa: E402
from src.backend.visibility import viewshed  # noqa: E402
⋮----
TARGETS = {"dismount": 1.7, "mount": 2.5}  # standing soldier vs vehicle
⋮----
def _profile(typ: str) -> dict
⋮----
"""Resolve a threat-template type key to the fields.py projection profile.

    Single source of truth is units.UNIT_CATALOG; this helper just reshapes it
    into the (fire/eye_h/eff/mx/arc) dict the projection loop below reads.
    """
u = resolve_unit(typ)
⋮----
def p_hit(dist: np.ndarray, eff: float, mx: float) -> np.ndarray
⋮----
"""Range-graduated hit probability: ~1 inside effective, fading to ~0.2 at max, 0 beyond."""
p = np.where(dist <= eff, 1.0, 1.0 - 0.8 * (dist - eff) / max(1.0, mx - eff))
⋮----
def run(side: str = "west", res: float = 2.0) -> dict
⋮----
"""Project the enemy laydown into threat fields — callable from CLI and /recompute."""
t = build_dsm(DATA / "point_cloud.ply", res, DATA / "bounding_boxes.json")
⋮----
threat = json.loads((BUILD / "threat.json").read_text())
enemies = threat["positions"]
# same avenue the laydown was templated against (operator-placed or auto)
⋮----
# coordinate grids (cell centres, UTM) for range / distance maths
⋮----
gx = transform.c + (cols + 0.5) * transform.a
gy = transform.f - (rows + 0.5) * (-transform.e)
⋮----
depth = {k: np.zeros((h, w), np.int16) for k in TARGETS}      # engagement-area depth
direct = {k: np.zeros((h, w), np.float32) for k in TARGETS}   # P(hit) union, range-graded
n_direct = 0
⋮----
prof = _profile(e["type"])
⋮----
facing = np.degrees(np.arctan2(aa_cy - N, aa_cx - E))
dist = np.hypot(gx - E, gy - N)
pr = p_hit(dist, prof["eff"], prof["mx"])
⋮----
depth[k] += vis                                       # +1 per shooter that sees it
direct[k] = 1.0 - (1.0 - direct[k]) * (1.0 - vis * pr)  # probabilistic union
⋮----
# ---- pre-planned TRPs on terrain-forced chokepoints (point 4) ----
box_mask = np.zeros((h, w), bool)
⋮----
box_mask = rasterize([(box_polygon(b), 1) for b in json.loads((DATA / "bounding_boxes.json").read_text())],
passable = (~box_mask) & t["valid"]
clearance = distance_transform_edt(passable) * res       # corridor half-width (m)
ridge = (clearance == maximum_filter(clearance, size=3)) & passable   # medial axis
choke = ridge & (clearance > 1.5) & (clearance < 7)           # narrow passages on the route net
trp = np.zeros((h, w), bool)
⋮----
for i in np.argsort(clearance[cr, cc]):                       # narrowest first
⋮----
trp[max(0, r - 2):r + 3, max(0, c - 2):c + 3] = True      # TRP beaten zone
⋮----
# ---- indirect: in mortar range AND (observed by any eyes OR pre-registered) ----
in_range = np.zeros((h, w), bool)
⋮----
observed = depth["dismount"] > 0
indirect = in_range.astype(np.float32) * np.clip(0.6 * observed + 0.7 * trp, 0.0, 0.9)
⋮----
# ---- cover (boxes stop rounds) reduces risk; combine to a continuous cost ----
cover_near = np.clip(1.0 - distance_transform_edt(~box_mask) * res / 8.0, 0.0, 1.0)
⋮----
d = direct[k]
emphasis = 1.0 + 0.35 * np.clip(depth[k] - 1, 0, None)    # kill zones (overlap) hurt more
cost = (d + 0.5 * indirect) * emphasis - 0.3 * cover_near
cost = np.clip(np.where(t["valid"] | box_mask, cost, 0.0), 0.0, 1.0)
⋮----
cost_dismount = cost
⋮----
# ---- per-web-point overlays for the viewer ----
pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
meta = pack["meta"]
⋮----
n = meta["n"]
pts = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
pc = ((pts[:, 0] + ox - transform.c) / transform.a).astype(np.int64)
prow = ((transform.f - (pts[:, 1] + oy)) / (-transform.e)).astype(np.int64)
ok = (pc >= 0) & (pc < w) & (prow >= 0) & (prow < h)
⋮----
danger_b = np.zeros(n, np.uint8)
⋮----
depth_b = np.zeros(n, np.uint8)
⋮----
info = {
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Project the enemy laydown into threat fields")
⋮----
a = ap.parse_args()
`````

## File: src/frontend/src/components/FriendlyPanel.tsx
`````typescript
import { postRecompute, postReset } from '../lib/api'
import { useStore } from '../lib/store'
import { UnitType } from '../lib/types'
⋮----
const hasLaydown = useStore((s) => s.threatInfo !== null) // an analysed laydown is on the map
⋮----
// Doctrinal unit choices come from /api/unit-profiles (backend UNIT_CATALOG).
// The same catalog drives both sides — adding a new unit type later needs no
// frontend change.
⋮----
// Static class strings — Tailwind's JIT cannot see interpolated names.
⋮----
const analyze = async () =>
⋮----
// Wipe the analysed laydown so the battlefield goes blank again.
const reset = async () =>
⋮----
// place / remove are mutually exclusive map modes
const togglePlacing = () =>
const toggleRemoving = () =>
const selectSide = (side: 'hostile' | 'friendly') =>
⋮----
{/* side selector: enemy (red) | ally (blue) */}
⋮----
<button onClick=
⋮----
{/* place / remove map modes — grouped right under the side selector */}
`````

## File: src/frontend/src/components/ObjectPopup.tsx
`````typescript
import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
`````

## File: src/frontend/src/index.css
`````css
@tailwind base;
@tailwind components;
@tailwind utilities;
⋮----
@layer base {
⋮----
html,
⋮----
body {
⋮----
button:focus-visible,
⋮----
::selection {
⋮----
@layer components {
⋮----
/* Flat industrial chrome: hairline borders, no gradients/glow/blur. */
.skip-link {
⋮----
.app-shell {
⋮----
.panel {
⋮----
.eyebrow {
⋮----
.tactical-button {
⋮----
.tactical-button:hover:not(:disabled) {
⋮----
.legend-cell {
⋮----
.legend-cell:hover {
⋮----
.segmented-toggle {
⋮----
.segmented-toggle > button + button {
⋮----
.skeleton-bar {
⋮----
.skeleton-bar::after {
⋮----
*,
`````

## File: pyproject.toml
`````toml
[project]
name = "se3-reconnaissance"
version = "0.1.0"
description = "Tactical AI layer on SE3's 3D battlefield reconstruction (EDTH Munich)"
requires-python = ">=3.12"
dependencies = [
    "numpy>=2.0",
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "rasterio>=1.4",
    "shapely>=2.0",
    "scipy>=1.13",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]

[tool.hatch.metadata]
allow-direct-references = true

[tool.ruff]
target-version = "py312"
respect-gitignore = true
line-length = 135

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "F",   # pyflakes
  "I",   # isort
  "B",   # bugbear
  "C4",  # comprehensions
  "TCH", # type-checking hygiene
  "SIM", # simplify
  "ANN", # type hints
  "ARG", # unused arguments
  "RUF"  # Ruff-native rules
]
ignore = [
  "RUF100",
  "B904"
]

[tool.ruff.lint.isort]
force-sort-within-sections = true
section-order = ["future", "standard-library", "third-party", "first-party", "local-folder"]

# Enables Ruff formatter with default options (Black-compatible)
[tool.ruff.format]
`````

## File: run.sh
`````bash
#!/bin/bash

export PATH="$(pwd)/.venv/bin:$PATH"

# Ports come from the shared config (src/config.json) so front and back agree.
read -r HOST PORT FE_PORT < <(python3 -c "import json;c=json.load(open('src/config.json'));print(c['backend']['host'],c['backend']['port'],c['frontend']['port'])")

echo "Starting backend on http://$HOST:$PORT"
source .venv/bin/activate
uv run uvicorn src.backend.app:app --host "$HOST" --port "$PORT" --reload --reload-dir src &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:$FE_PORT"
npm --prefix src/frontend run dev &
FRONTEND_PID=$!

cleanup() {
  echo "Shutting down..."
  for PID in $BACKEND_PID $FRONTEND_PID; do
    kill -TERM -- "-$PID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}

trap cleanup INT TERM

wait
`````

## File: src/frontend/index.html
`````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SE3 Recon turns georeferenced point clouds into tactical line-of-sight and object inspection decisions." />
    <meta property="og:title" content="SE3 Recon Tactical Viewer" />
    <meta property="og:description" content="A tactical 3D viewer for point-cloud terrain, object boxes, and viewshed readiness." />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#071014" />
    <title>SE3 Tactical Intelligence</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`````

## File: .gitignore
`````
# ---- provided data (large / sensitive — get from the SE3 mentor, never commit) ----
data/*.ply
data/*.json
data/*.pcd
data/*.las
data/*.laz
data/*.bag
data/**/*.ply
data/**/*.json
*__pycache__*
src/frontend/.vite/

# ---- frontend (node + build output) ----
src/frontend/node_modules/
src/frontend/dist/
# generated web assets — only .gitkeep is tracked (data comes from the API/build)
src/frontend/public/*
!src/frontend/public/.gitkeep
src/frontend/.env.local
src/frontend/.env*.local

# ---- rendered figures / screenshots (derived from the data — keep out of git) ----
docs/figures/
*.png
*.jpg

# ---- python / uv ----
.venv/
venv/
__pycache__/
*.pyc
.ruff_cache/
.pytest_cache/
*.egg-info/
# backend generated (DSM, viewshed, threat, etc.)
build/
# Python package dist
dist/
uv.lock

# ---- tooling / editor / os ----
.claude/
.playwright-mcp/
.DS_Store
__MACOSX/
.vscode/
.idea/

# stale tsc emits
src/frontend/vite.config.js
src/frontend/vite.config.d.ts
`````

## File: README.md
`````markdown
# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction: turn labeled geometry into the
> judgments an operator needs — *where is the enemy likely to approach, where do
> I have field of fire, where am I exposed* — fast and legible.

Docs:
- [`docs/challange.md`](docs/challange.md) — the challenge brief & our direction
- [`docs/data.md`](docs/data.md) — exactly what's in the dataset (inspected, not assumed)
- [`docs/THREAT_LIBRARY.md`](docs/THREAT_LIBRARY.md) — Red (OPFOR) asset model: per-system observation + weapon envelopes
- [`docs/MANEUVER_ANALYSIS.md`](docs/MANEUVER_ANALYSIS.md) — Blue course of action: threat maps, covered approach, suppression priority, go/no-go

## Repo layout

```
.
├── data/                 # provided inputs — gitignored (get from the SE3 mentor)
│   ├── point_cloud.ply   #   ~4M-point cloud, XYZ (UTM, metres) + RGB
│   └── bounding_boxes.json#   58 oriented object boxes + thermal signature
├── src/
│   ├── backend/          # Python: data IO + FastAPI server + tactical analysis
│   │   ├── io.py         #   PLY reader (memmap, zero-copy)
│   │   ├── app.py        #   FastAPI: packs cloud on startup, serves viewer + data
│   │   ├── terrain.py    #   DSM from cloud + boxes as occluders (build/dsm.tif)
│   │   ├── visibility.py #   line-of-sight viewshed (build/viewshed.*)
│   │   └── scripts/      #   inspect_ply.py (data sanity-check)
│   └── frontend/         # React + Vite + three.js tactical UI (modern, polished)
│       ├── src/
│       │   ├── app/      #   layout (AppContent.tsx)
│       │   ├── components/ # SceneViewer, ControlPanel, ThreatPanel, LayerStack
│       │   ├── contexts/ #   ViewerContext (state)
│       │   ├── hooks/    #   useScene (data loading)
│       │   └── lib/      #   api.ts, types.ts, colors.ts, utils.ts
│       ├── package.json  #   React, Vite, three.js, TailwindCSS
│       └── index.html    #   vite entry
├── build/                # generated layers (DSM/viewshed) — gitignored
├── docs/                 # challenge brief + data findings
├── pyproject.toml        # uv / hatchling project (ruff configured)
└── run.sh                # ./run.sh → uvicorn at :8011
```

## Quickstart

```bash
# 1. install python deps (uv)
uv sync

# 2. put the provided files in data/  (not in git)
#    data/point_cloud.ply
#    data/bounding_boxes.json

# 3. install frontend deps (npm)
cd src/frontend && npm install && cd ../..

# 4. start both backend + frontend with one command
./run.sh

# Then open http://localhost:5173 in your browser
# (Ctrl-C stops both servers)

# 5. (optional) build the viewshed overlay shown in the viewer
uv run python src/backend/visibility.py   # writes build/viewshed.*
```

Then open <http://localhost:8011>. Inspect the raw cloud any time with:

```bash
uv run python src/backend/scripts/inspect_ply.py
```

## The viewer

True 1:1 scale (no vertical exaggeration). Point cloud (RGB / height-coloured /
**viewshed**) with all 58 oriented object boxes overlaid — colour by **class** or
by **thermal** signature, per-class show/hide, click any box for its
dimensions / temperature / UTM position. North arrow + 100 m grid for scale.
**Viewshed** mode (after running `visibility.py`) paints points red = seen by the
enemy OP, green = dead ground, with the observer marker + range ring.

## Status / roadmap

We model a realistic **Russian threat laydown** and compute how friendly forces
maneuver against it. The spine is one primitive — the **viewshed** — because
observation gates lethality (direct fire: a weapon sees you; indirect fire: an
observer sees you). See the two tactical docs above.

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [x] Tactical concept: threat library (Red) + maneuver analysis (Blue)
- [x] Terrain DSM from the cloud + the 58 boxes as occluders (`terrain.py`)
- [x] **Viewshed / line-of-sight engine** (`visibility.py`) + 3D overlay — core
- [ ] Vegetation / concealment layer from the cloud (cover vs concealment)
- [ ] `data/enemy_assets.json` schema + place Red assets in the viewer
- [ ] Slice 2 — FastAPI endpoint → live "drop a pin" viewshed
- [ ] Threat maps: combined observation `O`, direct-fire `D`, indirect `I`
- [ ] Approach-route cost surface → covered axis, bounds, chokepoints, dead ground
- [ ] Suppression priority (HVT) + go/no-go callout, in MGRS, < 10 s
- [ ] Enemy-perspective viewshed (drop a pin → what they see & threaten)

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh` after you drop the data in.
`````

## File: src/backend/threat_template.py
`````python
"""Enemy laydown — built from OPERATOR-placed positions (real intel), not auto-templated.

The operator (with the soldiers) marks where the enemy actually is on the map; we turn
those marks into a structured laydown that fields.py then projects into fields of fire,
engagement-area depth (kill zones) and the danger surface. No guessing where the enemy
might be — the human provides ground truth, the system does the spatial reasoning.

Called from /api/threat/recompute with the placed enemies (and optionally our own
positions, which the shooters are oriented onto).
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.io import read_ply  # noqa: E402
from src.backend.terrain import BUILD, DATA  # noqa: E402
from src.backend.units import resolve_unit  # noqa: E402
⋮----
def from_manual(enemies: list[dict], friendly: list[tuple[float, float, float]] | None = None) -> dict
⋮----
"""enemies: [{e,n,u,type}] (type ∈ sniper_op|tank|mortar|...). friendly: [[E,N,U]] (optional).

    Writes build/threat.json — the laydown fields.py projects. Direct-fire shooters are
    oriented onto our positions if given, else toward the scene centre. Per-type arc
    and role come from the unit catalog (single source of truth, units.py).
    """
v = read_ply(DATA / "point_cloud.ply")
⋮----
fx = float(np.mean([f[0] for f in friendly]))
fy = float(np.mean([f[1] for f in friendly]))
⋮----
positions = []
⋮----
unit = resolve_unit(typ)
role = unit.role.value if unit else "observer"
arc = unit.obs_arc if unit else 0
facing = 0.0 if role == "indirect" else float(math.degrees(math.atan2(fy - N, fx - E)))
⋮----
info = {
⋮----
def main() -> None
`````

## File: src/frontend/src/App.tsx
`````typescript
import { useStore } from './lib/store'
import SceneCanvas from './components/SceneCanvas'
import Hud from './components/Hud'
import ObjectPopup from './components/ObjectPopup'
import ThreatPanel from './components/ThreatPanel'
import ThreatPopup from './components/ThreatPopup'
import PlacedUnitPopup from './components/PlacedUnitPopup'
import FriendlyPanel from './components/FriendlyPanel'
`````

## File: src/backend/app.py
`````python
"""FastAPI backend: pack the point cloud once on startup, serve it as an API.

    uv run uvicorn src.backend.app:app --port 8011      (or ./run.sh)

The UI is served separately by Vite (src/frontend). Endpoints:
  /api/meta · /api/cloud (binary) · /api/boxes
  /api/viewshed (binary) · /api/viewshed-info  — present only after
  `uv run python src/backend/visibility.py` writes them to build/.
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
BUILD = ROOT / "build"          # viewshed.{bin,json} land here (gitignored)
⋮----
CONFIG = json.loads((ROOT / "src" / "config.json").read_text())  # shared with frontend
VOXEL = CONFIG["cloud"]["voxel_m"]          # metres per voxel
MAX_POINTS = CONFIG["cloud"]["max_points"]  # cap on served points
⋮----
PACK: dict = {}  # {"bin": bytes, "meta": {...}} filled on startup
TERRAIN: dict[float, dict] = {}
UNITS: dict[str, UnitContact] = {}  # in-memory contact store; resets on server restart
⋮----
class ViewshedRequest(BaseModel)
⋮----
x: float
y: float
z: float | None = None
range_m: float = Field(1200.0, gt=0)
arc_deg: float = Field(360.0, gt=0, le=360)
facing_deg: float = 0.0
eye_h: float = 1.7
target_h: float = 1.7
res_m: float = Field(1.0, gt=0)
⋮----
def pack_cloud(ply: Path, voxel: float, max_points: int) -> dict
⋮----
"""Voxel-downsample to one point per occupied cell, recenter to a local origin.

    UTM doubles exceed float32 precision, so positions are stored relative to the
    min corner; the viewer works in metres from that origin. Layout of "bin":
    N float32 positions (xyz) followed by N uint8 colours (rgb).
    """
v = read_ply(ply)
⋮----
vi = ((x - ox) / voxel).astype(np.uint64)
vj = ((y - oy) / voxel).astype(np.uint64)
vk = ((z - oz) / voxel).astype(np.uint64)
_, sel = np.unique((vi << 42) | (vj << 21) | vk, return_index=True)  # one per voxel
⋮----
sel = np.sort(np.random.default_rng(0).choice(sel, max_points, replace=False))
⋮----
pos = np.empty((sel.size, 3), np.float32)
⋮----
# Source X/Y sit on a perfect 1/16 m DSM lattice, which renders as moiré
# "corduroy" lines. Sub-voxel horizontal jitter breaks the grid; no point
# moves more than half a voxel, and z (true elevation) is left untouched.
⋮----
col = np.empty((sel.size, 3), np.uint8)
⋮----
def terrain_for(res_m: float) -> dict
⋮----
def flags_for_viewshed(vis: np.ndarray, transform: Affine) -> np.ndarray
⋮----
meta = PACK["meta"]
n = meta["n"]
⋮----
buf = np.frombuffer(PACK["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
wx = buf[:, 0] + ox
wy = buf[:, 1] + oy
cols = ((wx - transform.c) / transform.a).astype(np.int64)
rows = ((transform.f - wy) / (-transform.e)).astype(np.int64)
⋮----
ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
flags = np.zeros(n, dtype=np.uint8)
⋮----
def clear_laydown() -> None
⋮----
"""Wipe the operator's enemy laydown and everything projected from it.

    The laydown is per-session intel, never carried over: the battlefield must
    open blank (terrain + object boxes only) until the operator places the enemy
    and analyses. Terrain artifacts (DSM, viewshed) are independent and kept.
    """
⋮----
@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]
⋮----
clear_laydown()  # start every session with an empty battlefield
⋮----
app = FastAPI(lifespan=lifespan)
⋮----
# Dev convenience: allow the Vite dev server to hit the API directly too.
_fe = CONFIG["frontend"]["port"]
⋮----
@app.get("/api/meta")
def meta() -> dict
⋮----
@app.get("/api/cloud")
def cloud() -> Response
⋮----
@app.get("/api/boxes")
def boxes() -> FileResponse
⋮----
@app.get("/api/viewshed")
def viewshed_bin() -> Response
⋮----
f = BUILD / "viewshed.bin"
⋮----
@app.post("/api/viewshed")
def viewshed_at_cursor(req: ViewshedRequest) -> Response
⋮----
terrain = terrain_for(req.res_m)
⋮----
flags = flags_for_viewshed(vis, terrain["transform"])
info = {
⋮----
@app.get("/api/viewshed-info")
def viewshed_info() -> Response
⋮----
f = BUILD / "viewshed.json"
⋮----
@app.get("/api/threat")
def threat_bin() -> Response
⋮----
f = BUILD / "threat.bin"
⋮----
@app.get("/api/threat-info")
def threat_info() -> Response
⋮----
f = BUILD / "threat.json"
⋮----
def _bin(name: str) -> Response
⋮----
f = BUILD / name
⋮----
@app.get("/api/danger")
def danger() -> Response
⋮----
@app.get("/api/depth")
def depth() -> Response
⋮----
@app.get("/api/fields-info")
def fields_info() -> Response
⋮----
f = BUILD / "fields.json"
⋮----
# ---- unit contact store -------------------------------------------------------
⋮----
@app.get("/api/units")
def list_units(side: str | None = None) -> list[UnitContact]
⋮----
units = list(UNITS.values())
⋮----
units = [u for u in units if u.side.value == side]
⋮----
@app.get("/api/unit-profiles")
def unit_profiles_endpoint() -> list[dict]
⋮----
"""Doctrinal catalog as lightweight profile dicts — the frontend's single
    source of truth for per-type range/arc/label (drag-preview rings, popups).
    No placement state; pure type definitions."""
⋮----
@app.post("/api/units")
def place_unit(req: PlaceUnitRequest) -> UnitContact
⋮----
# unit_type is a pydantic-validated UnitType enum, so the catalog lookup always hits.
contact = resolve_unit(req.unit_type.value).new_contact(req)
⋮----
@app.delete("/api/units/{unit_id}")
def delete_unit(unit_id: str) -> dict
⋮----
@app.delete("/api/units")
def clear_units(side: str | None = None) -> dict
⋮----
to_remove = [k for k, v in UNITS.items() if v.side.value == side]
⋮----
# ---- threat recompute ---------------------------------------------------------
⋮----
class PlacedEnemy(BaseModel)
⋮----
e: float
n: float
u: float
type: str = "sniper_op"  # sniper_op | tank | mortar (legacy; new flow uses /api/units)
⋮----
class RecomputeReq(BaseModel)
⋮----
enemies: list[PlacedEnemy] | None = None   # explicit override; omit to use /api/units store
friendly: list[list[float]] | None = None
⋮----
@app.post("/api/threat/recompute")
def recompute(req: RecomputeReq | None = None) -> dict
⋮----
"""Build the enemy laydown from operator-placed positions, then project the
    fires/observation fields (kill zones, danger). Reads from the /api/units store
    unless an explicit payload overrides it. Returns counts for the UI."""
from src.backend import fields, threat_template  # noqa: PLC0415
⋮----
# resolve enemies: explicit body > UNITS store
⋮----
enemies = [e.model_dump() for e in req.enemies]
⋮----
enemies = [
⋮----
# sniper_op is the legacy key threat_template expects; map sniper → sniper_op
⋮----
friendly_pts: list[tuple[float, float, float]] | None = [
⋮----
friendly_pts = [
⋮----
n_friendly = len(friendly_pts) if friendly_pts else 0
⋮----
@app.post("/api/threat/reset")
def reset() -> dict
⋮----
"""Clear the laydown so the battlefield goes blank again (operator clear)."""
`````

## File: src/frontend/src/components/Hud.tsx
`````typescript
import { useState } from 'react'
import { CLASS_COLORS } from '../lib/colors'
import { useStore } from '../lib/store'
import { BoxClass, ColorMode } from '../lib/types'
⋮----
onClick=
`````

## File: src/frontend/src/lib/api.ts
`````typescript
import { CloudMeta, BoundingBox, ViewshedInfo, ThreatInfo, FieldsInfo, WorldCoordinate, ViewshedResult, UnitContact, PlaceUnitRequest, UnitProfile } from './types'
⋮----
// Relative URLs: dev goes through the Vite proxy (vite.config.ts), prod is
// served same-origin. Required GETs throw; optional ones resolve to null.
const json = <T>(p: string): Promise<T>
⋮----
const optional = async <T>(p: string): Promise<T | null> =>
⋮----
export const fetchMeta = ()
export const fetchBoxes = ()
export const fetchViewshedInfo = ()
⋮----
export const fetchCloud = async (): Promise<ArrayBuffer> =>
⋮----
export const fetchViewshed = async (): Promise<Uint8Array | null> =>
⋮----
export const fetchThreatInfo = ()
⋮----
export const fetchThreat = async (): Promise<Uint8Array | null> =>
⋮----
export const fetchFieldsInfo = ()
⋮----
const bin = async (p: string): Promise<Uint8Array | null> =>
export const fetchDanger = ()
export const fetchDepth = ()
⋮----
export const fetchViewshedAt = async (world: WorldCoordinate): Promise<ViewshedResult> =>
⋮----
// Build the enemy laydown from operator-placed positions + project the fields. Heavy (~15 s).
// Omit body to use the backend's /api/units store as the source.
export const postRecompute = (): Promise<
⋮----
// Wipe the analysed laydown (enemy markers + projected fields) — back to a blank battlefield.
export const postReset = (): Promise<
⋮----
export const fetchUnits = (): Promise<UnitContact[]>
⋮----
export const fetchUnitProfiles = (): Promise<UnitProfile[]>
⋮----
export const postUnit = (req: PlaceUnitRequest): Promise<UnitContact>
⋮----
export const deleteUnit = (id: string): Promise<void>
⋮----
export const clearUnits = (side?: 'hostile' | 'friendly'): Promise<void>
`````

## File: src/frontend/src/lib/store.ts
`````typescript
import { create } from 'zustand'
⋮----
import { BoundingBox, BoxClass, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, Layers, PlaceUnitRequest, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo } from './types'
⋮----
interface AppState {
  meta: CloudMeta | null
  boxes: BoundingBox[]
  viewshedInfo: ViewshedInfo | null
  viewshedReady: boolean
  threatInfo: ThreatInfo | null
  threatReady: boolean
  fieldsInfo: FieldsInfo | null
  fieldsReady: boolean
  loading: boolean
  error: string | null

  colorMode: ColorMode
  overlayOnRgb: boolean
  layers: Layers
  classVisibility: ClassVisibility
  selected: BoundingBox | null
  selectedCursor: SceneCursor | null
  selectedThreat: ThreatPosition | null
  selectedThreatPoint: ScreenPoint | null
  selectedUnitId: string | null
  placing: 'enemy' | 'friendly' | null
  removing: boolean
  activeSide: 'hostile' | 'friendly'
  activeUnitType: UnitType
  units: UnitContact[]
  unitProfiles: UnitProfile[]
  scanning: boolean

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null; threatInfo: ThreatInfo | null; fieldsInfo: FieldsInfo | null }) => void
  setReady: (r: { viewshedReady: boolean; threatReady: boolean; fieldsReady: boolean }) => void
  setViewshed: (viewshedInfo: ViewshedInfo) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  setOverlayOnRgb: (overlayOnRgb: boolean) => void
  toggleLayer: (key: LayerKey) => void
  toggleClass: (key: BoxClass) => void
  select: (selected: BoundingBox | null, selectedCursor?: SceneCursor | null) => void
  selectThreat: (selectedThreat: ThreatPosition | null, selectedThreatPoint?: ScreenPoint | null) => void
  selectUnit: (id: string | null, cursor?: SceneCursor | null) => void
  setSelectedCursorScreen: (screen: ScreenPoint) => void
  setPlacing: (placing: 'enemy' | 'friendly' | null) => void
  setRemoving: (removing: boolean) => void
  setActiveSide: (side: 'hostile' | 'friendly') => void
  setActiveUnitType: (t: UnitType) => void
  setUnits: (units: UnitContact[]) => void
  setUnitProfiles: (profiles: UnitProfile[]) => void
  placeUnit: (req: PlaceUnitRequest) => Promise<void>
  removeUnit: (id: string) => Promise<void>
  clearUnits: (side: 'hostile' | 'friendly') => Promise<void>
  setScanning: (scanning: boolean) => void
}
`````

## File: src/frontend/src/lib/types.ts
`````typescript
export type BoxClass = 'car' | 'container' | 'wall' | 'house' | 'shelter'
⋮----
export interface CloudMeta {
  n: number
  origin: [number, number, number]
  span: [number, number, number]
}
⋮----
export type WorldCoordinate = [number, number, number]
⋮----
export interface BoundingBox {
  id: string
  name: string
  class_label: BoxClass
  center: [number, number, number]
  extent: [number, number, number]
  rotation: [number, number, number, number]
  avg_temperature: number
}
⋮----
export interface ViewshedInfo {
  observer_label: string
  observer_world: [number, number, number]
  params: {
    range_m: number
    arc_deg: number
    facing_deg: number
    eye_h: number
    target_h: number
    res_m: number
  }
  pct_points_visible: number
  cells_visible: number
}
⋮----
export type ThreatRole = 'observer' | 'anti_armor' | 'indirect'
export type ThreatType = 'sniper_op' | 'tank' | 'mortar'
⋮----
// ---- unified unit contact model (mirrors src/backend/units.py) ---------------
⋮----
export type UnitSide        = 'friendly' | 'hostile' | 'unknown'
export type UnitWeightClass = 'heavy' | 'medium' | 'light'
export type UnitType        = 'tank' | 'ifv' | 'apc' | 'assault' | 'sniper' | 'mortar'
export type UnitFireKind    = 'direct' | 'indirect' | 'observer'
export type UnitSource      = 'visual' | 'thermal' | 'reported' | 'sigint' | 'templated'
⋮----
/**
 * Doctrinal type definition (no placement/intel fields). Mirror of the backend's
 * `Unit.to_profile()` served at `GET /api/unit-profiles`. This is the frontend's
 * ONLY source of per-type range/arc/label — the drag-preview rings and popups
 * read from here, never from a hand-maintained duplicate.
 */
export interface UnitProfile {
  unit_type:    UnitType
  label:        string
  weight_class: UnitWeightClass
  role:         ThreatRole
  fire_kind:    UnitFireKind
  obs_arc:      number            // sector of observation, degrees
  eff_range_m:  number           // effective observation / engagement range, m
  max_range_m:  number           // maximum effective range, m
  height_agl_m: number           // sensor/eye height above local terrain
}
⋮----
obs_arc:      number            // sector of observation, degrees
eff_range_m:  number           // effective observation / engagement range, m
max_range_m:  number           // maximum effective range, m
height_agl_m: number           // sensor/eye height above local terrain
⋮----
export interface UnitContact {
  id:                string
  side:              UnitSide
  weight_class:      UnitWeightClass
  unit_type:         UnitType
  label:             string
  role:              ThreatRole
  fire_kind:         UnitFireKind
  world:             [number, number, number]   // UTM (E, N, elevation_m)
  confidence:        number
  sec_since_contact: number
  source:            UnitSource
  azimuth:           number | null
  obs_arc:           number
  eff_range_m:       number
  max_range_m:       number
  height_agl_m:      number
  velocity:          [number, number] | null
}
⋮----
world:             [number, number, number]   // UTM (E, N, elevation_m)
⋮----
export interface PlaceUnitRequest {
  side:       UnitSide
  unit_type:  UnitType
  world:      [number, number, number]
  azimuth:    number | null
  velocity:   [number, number] | null
  confidence?: number
  source?:    UnitSource
}
⋮----
export interface ThreatPosition {
  id: string
  role: ThreatRole
  type: ThreatType
  world: [number, number, number]
  facing_deg: number
  arc_deg: number
  score: number
  sees_pct_of_approach: number
  cover_dist_m: number
  height_above_ground_m: number
  thermal_cue: number
  defilade_m: number
}
⋮----
export interface ThreatInfo {
  side: string
  aa_points: number
  range_m: number
  avenue_source: string
  avenue: [number, number, number][]
  avenue_centroid: [number, number]
  positions: ThreatPosition[]
}
⋮----
export interface FieldsInfo {
  side: string
  n_direct_shooters: number
  max_engagement_depth: number
  trps: [number, number][]
  pct_in_kill_zone: number
  note: string
}
⋮----
export type ColorMode = 'rgb' | 'height' | 'temperature' | 'viewshed' | 'threat' | 'danger' | 'depth'
export type LayerKey = 'points' | 'boxes' | 'observer' | 'threats'
export type Layers = Record<LayerKey, boolean>
export type ClassVisibility = Record<BoxClass, boolean>
export interface ScreenPoint {
  x: number
  y: number
}
export interface SceneCursor {
  screen: ScreenPoint
  world: WorldCoordinate
}
⋮----
export interface ViewshedResult {
  flags: Uint8Array
  info: ViewshedInfo
}
`````

## File: src/frontend/src/components/SceneCanvas.tsx
`````typescript
import { useEffect, useRef } from 'react'
import { Viewer } from '../engine/Viewer'
import { useStore } from '../lib/store'
⋮----
/** Mounts the three.js engine once and forwards store changes to it. */
export default function SceneCanvas()
`````

## File: src/frontend/src/engine/Viewer.ts
`````typescript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { BoundingBox, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo, WorldCoordinate } from '../lib/types'
import ms from 'milsymbol'
import { CLASS_COLORS, TURBO } from '../lib/colors'
import { fetchCloud, fetchViewshed, fetchThreat, fetchDanger, fetchDepth } from '../lib/api'
import { v2w, w2v } from '../lib/utils'
⋮----
// NATO APP-6 / MIL-STD-2525 symbol codes (SIDC). Affiliation: H=hostile, F=friend.
// Both affiliations carry per-type icons so enemy and ally markers render with the
// same doctrinal shape — only affiliation colour (red/blue) differs.
⋮----
sniper_op: 'SHGPUCIS----',  // legacy key used by analyzed threat template
⋮----
function sidcFor(unit: UnitContact): string
// one CanvasTexture per SIDC, reused across markers
⋮----
function symbolTexture(sidc: string): THREE.Texture
⋮----
// Module-level cache: the 54 MB cloud is fetched at most once per page load,
// surviving React StrictMode double-mounts and component remounts.
⋮----
// engagement-area depth palette: 0 dead · 1 single · 2 cross-fire · 3+ kill zone
⋮----
// Doctrinal catalog fetched from /api/unit-profiles (backend units.UNIT_CATALOG).
// Used only for the drag-preview envelope shown between placement and the
// /api/units round-trip; once a UnitContact comes back, its own eff_range_m /
// obs_arc drive the persisted marker's range ring + sector wedge.
⋮----
// sRGB → linear transfer (IEC 61966-2-1). Vertex colours must be linear because
// the renderer re-encodes to sRGB on output.
const srgb2lin = (c: number)
⋮----
/**
 * The three.js world. Created once, driven imperatively. React never touches
 * the scene graph — it calls these methods and lets the engine own the WebGL
 * lifecycle (init, render loop, dispose).
 */
export class Viewer
⋮----
private colRGBArr?: Float32Array   // linear RGB base, for blending overlays onto the real map
⋮----
constructor(private canvas: HTMLCanvasElement)
⋮----
const loop = () =>
⋮----
/** Fetch the cloud + viewshed + threat and build the whole scene. Idempotent. */
async load(meta: CloudMeta, boxes: BoundingBox[], vs: ViewshedInfo | null,
threat: ThreatInfo | null, fields: FieldsInfo | null): Promise<
⋮----
// The renderer outputs sRGB; vertex colours aren't auto-converted, so feed
// it linear. LUT maps the scan's 0-255 sRGB channels → linear once.
⋮----
// origin cancels out (served points are local): view = local - span/2
⋮----
colTH[i * 3] = srgb2lin(0.1) // cold = unlikely enemy position
⋮----
const c = TURBO(v) // turbo heatmap = how well the position dominates our approach
⋮----
const colDG = new Float32Array(n * 3) // continuous danger/cost surface (turbo)
⋮----
const colDP = new Float32Array(n * 3) // engagement-area depth (overlapping fields of fire)
⋮----
setColorMode(mode: ColorMode)
⋮----
setOverlayOnRgb(on: boolean)
⋮----
// Composite a threat overlay over the real photographic colours: out = rgb*(1-a) + tint*a,
// where the tint's strength (a) scales with how "hot" the cell is. Lets you read the
// danger/kill-zone/viewshed on the actual map instead of a flat heatmap. Null = no overlay
// for this mode (rgb/height/temperature), so the pure attribute is used.
private blendedOverlay(mode: ColorMode): THREE.BufferAttribute | null
⋮----
} else { // threat / danger — turbo, strength = value
⋮----
setLayer(key: LayerKey, visible: boolean)
⋮----
setClassVisibility(visibility: ClassVisibility)
⋮----
setSelected(id: string | null)
⋮----
setViewshed(flags: Uint8Array, info: ViewshedInfo)
⋮----
onPick(cb: (box: BoundingBox | null, cursor?: SceneCursor) => void)
⋮----
onPickThreat(cb: (p: ThreatPosition | null, point?:
⋮----
onCursorScreen(cb: (screen: ScreenPoint) => void)
⋮----
setCursorAnchor(world: WorldCoordinate | null)
⋮----
// ---- operator placement (enemy from intel, or our own positions) ----
setPlacing(mode: 'enemy' | 'friendly' | null)
⋮----
setRemoving(on: boolean)
⋮----
setActiveUnitType(t: UnitType)
setActiveSide(s: 'hostile' | 'friendly')
⋮----
/** Receive the doctrinal catalog from /api/unit-profiles. Drag-preview rings
   *  for operator placement read range/arc from here, never from a hardcoded table. */
setUnitProfiles(profiles: UnitProfile[])
⋮----
private profileFor(t: UnitType): UnitProfile
⋮----
onPlaceFriendly(cb: (e: number, n: number, u: number, yaw_deg: number) => void)
⋮----
onPlaceEnemy(cb: (e: number, n: number, u: number, yaw_deg: number) => void)
⋮----
onRemoveUnit(cb: (id: string) => void)
onPickPlacedUnit(cb: (id: string, cursor: SceneCursor) => void)
⋮----
setEnemyMarkers(units: UnitContact[])
⋮----
setFriendlyMarkers(units: UnitContact[])
⋮----
/** Builds a placed-contact marker — pole, NATO icon (azimuth-rotated), ground
   *  ring, and range/sector overlay. Enemy (red) and ally (blue) render with
   *  identical geometry; only affiliation colour differs, so both sides behave
   *  the same in the UI. */
private placeContacts(units: UnitContact[], side: 'hostile' | 'friendly', group: THREE.Group, color: number)
⋮----
private clearGroup(g: THREE.Group)
⋮----
// sprites share one module-level geometry — disposing it would churn every other sprite
⋮----
dispose()
⋮----
// ---- internals ----
⋮----
private buildBoxes(boxes: BoundingBox[], meta: CloudMeta)
⋮----
private updateBoxColors()
⋮----
// Likely enemy positions (threat template output) → distinct 3D assets:
// ◆ sniper/OP · ▮ tank · ⬢ mortar. The markers ARE the verification.
// Flat ground overlays (rings, sector wedges, crosshairs) must render ON TOP of the
// cloud — otherwise they sit at the scene's min elevation and get buried under the
// undulating terrain (only visible from underneath). depthTest off + high renderOrder.
private decal<T extends THREE.Mesh>(mesh: T): T
⋮----
// Range ring + optional sector wedge for operator-placed enemies.
// thetaStart maps compass yaw to THREE.CircleGeometry theta (0=east after rotation.x=-PI/2).
private rangeOverlay(vx: number, vy: number, vz: number, yaw_deg: number, profile: UnitProfile, color = 0xff2b2b): THREE.Object3D[]
⋮----
// A prominent friendly-troop marker (raised blue pole + cone icon + ground ring),
// matching the enemy markers so our disposition is just as visible from the top.
/** A billboarded NATO/APP-6 unit symbol — always faces the camera, always drawn on top. */
private symbolSprite(sidc: string, worldH = 14): THREE.Sprite
⋮----
private friendlyMarker(E: number, N: number, U: number, meta: CloudMeta): THREE.Object3D[]
⋮----
private buildThreat(threat: ThreatInfo, meta: CloudMeta)
⋮----
// sector of fire — a ground wedge showing which way this shooter observes/engages.
// At the shooter's own elevation (not the scene floor) and drawn on top of the cloud.
⋮----
wedge.renderOrder = 3 // beneath the rings/markers but above the cloud
⋮----
// OUR troops / avenue of approach — prominent blue markers (the friendly disposition
// the enemy is templated against), + an advance-axis arrow toward the objective.
⋮----
const dir = new THREE.Vector3(-sx0, 0, -sz0).normalize() // toward objective (scene centre)
⋮----
// Pre-planned mortar target points on chokepoints (cyan crosshair markers).
private buildTRPs(fields: FieldsInfo, meta: CloudMeta)
⋮----
private buildViewshedColors(flags: Uint8Array)
⋮----
colVS[i * 3] = srgb2lin(seen ? 1 : 0.12) // seen → red, dead ground → green
⋮----
private buildObserver(vs: ViewshedInfo, meta: CloudMeta)
⋮----
private clearObserver()
⋮----
// Only swallow keys while typing — a focused checkbox/button must not kill nav.
⋮----
// WASD/QE move position, arrows orient the camera.
⋮----
private apply(dt: number)
⋮----
// WASD/QE: pan camera + target together; speed scales with zoom.
private move(dt: number)
⋮----
// Use the camera's own right axis (matrix col 0) — robust even looking down,
// unlike crossing the look-dir with up (degenerate near top-down).
⋮----
// Arrows: look around in place — rotate the target about the camera (the
// camera is the pivot), so it feels like turning your head while flying.
private orient(dt: number)
⋮----
// camera stays put; target swings around it → look-in-place
⋮----
private resize()
⋮----
private emitCursorScreen()
⋮----
private toNDC(e: MouseEvent)
⋮----
private yawFromPinToViewer(vx: number, vz: number, hitX: number, hitZ: number)
⋮----
// north = -Z in viewer space; yaw = angle from north, clockwise
⋮----
// placement is handled by mousedown/move/up (drag-to-orient) for both sides — skip here
⋮----
// remove mode: clicking a placed unit deletes it
⋮----
// placed operator units — click opens info popup anchored to world coord
⋮----
// enemy markers take priority over boxes
⋮----
private sceneCursor(e: MouseEvent, point: THREE.Vector3): SceneCursor
`````
