# Module Map

```text
.
├── data/                         provided inputs, gitignored
├── build/                        generated layers (DSM, viewshed, threat, fields), gitignored
├── src/
│   ├── backend/                  Python IO, FastAPI, tactical analysis
│   │   ├── app.py                API server, cloud packer, unit store, threat recompute
│   │   ├── io.py                 zero-copy PLY reader
│   │   ├── terrain.py            DSM + box occluders
│   │   ├── visibility.py         radial LOS viewshed
│   │   ├── units.py              doctrinal unit catalog (single source of truth)
│   │   ├── threat_template.py    operator-placed enemies -> build/threat.json laydown
│   │   ├── fields.py             fires/observation projection -> danger, depth, TRPs
│   │   ├── README.md             backend notes and roadmap
│   │   └── scripts/
│   │       └── inspect_ply.py    data sanity-check CLI
│   ├── frontend/                 React/Vite/three.js tactical UI
│   │   ├── src/
│   │   │   ├── components/       HUD, panels, popups, canvas mount
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
| `app.py` | **FastAPI server.** On startup `pack_cloud()` voxel-downsamples the PLY, recenters to local origin, adds sub-voxel horizontal jitter, and stores packed bytes in RAM. Lifespan also calls `clear_laydown()` so each session starts on a blank battlefield. Endpoints: `/api/{meta,cloud,boxes,viewshed,viewshed-info,threat,threat-info,danger,depth,fields-info,units,unit-profiles}`, `POST /api/{viewshed,threat/recompute,threat/reset,units}`, `DELETE /api/units[/{id}]`. Holds an in-memory `UNITS` contact store. Reads shared settings from `src/config.json`; CORS enabled for the Vite dev server. |
| `terrain.py` | **DSM builder.** `build_dsm()` creates a max-height grid from the cloud, rasterizes the 58 oriented boxes as solid occluders, nearest-fills gaps, and returns the DSM + transform + bounds + EPSG (and caches `build/dsm.tif`). Helpers: `box_yaw`, `box_polygon`, `world_to_pixel`, `save_geotiff`. |
| `visibility.py` | **Viewshed engine.** `viewshed()` computes radial line-of-sight from an observer on the DSM using range, arc, facing, eye height, target height. Auto-places the default observer on a roof edge. Writes `build/viewshed.{tif,bin,json}` for API/viewer use. |
| `units.py` | **Doctrinal unit catalog.** `Unit` (static type def) + `UnitContact` (placed instance) + `PlaceUnitRequest` (POST body). `UNIT_CATALOG` covers tank/ifv/apc/assault/sniper/mortar with range, arc, role, fire kind, height AGL. Single source of truth for per-type props — read by `threat_template`, `fields`, and `GET /api/unit-profiles`. `resolve_unit()` handles the legacy `sniper_op` alias. |
| `threat_template.py` | **Enemy laydown builder.** `from_manual(enemies, friendly)` turns operator-placed enemies into `build/threat.json`. Direct-fire shooters are oriented onto friendly positions (or scene centre); indirect units get no sector of fire. Per-type arc/role come from the unit catalog. Not auto-templated — operator provides ground truth. |
| `fields.py` | **Fires/observation projection.** `run(side, res)` reads `build/threat.json`, projects each direct-fire shooter's LOS (range-graduated `p_hit`, per-asset sector), counts engagement-area depth (kill zones at >=2 overlap), detects terrain-forced chokepoint TRPs via clearance medial-axis, computes indirect fire (mortar range AND observed/TRP), applies cover reduction, and writes `build/fields_cost_{dismount,mount}.tif`, `fields_depth.tif`, `danger.bin`, `depth.bin`, `fields.json`. |
| `scripts/inspect_ply.py` | Prints PLY header, axis stats, color uniqueness sample, and elevation percentiles for sanity checks. |

Planned backend modules still live conceptually after `fields.py`: `routes.py`
for least-cost maneuver outputs and `landcover.py` for a vegetation/concealment
mask separate from hard cover.

## Frontend — `src/frontend/`

| File | Responsibility |
|------|----------------|
| `src/App.tsx` | Root full-screen tactical layout. Renders `SceneCanvas`, `Hud`, `FriendlyPanel`, `ObjectPopup`, `ThreatPanel`, `ThreatPopup`, `PlacedUnitPopup`, and loading/error overlays. |
| `src/components/SceneCanvas.tsx` | Mounts the three.js engine once and forwards Zustand store changes into it. |
| `src/components/Hud.tsx` | Top-left mission/status HUD showing scene span, point count, object count, and keyboard controls. |
| `src/components/FriendlyPanel.tsx` | Operator unit-placement controls: hostile/friendly side toggle, unit-type picker (from `/api/unit-profiles`), place/remove map modes, **Analyze** (`POST /api/threat/recompute`) and **Reset** (`POST /api/threat/reset`) buttons. |
| `src/components/ThreatPanel.tsx` | Ranked list of likely enemy positions from `/api/threat-info`, visible only in threat color mode. |
| `src/components/InfoPanelPopup.tsx` | Generic anchor-following popup wrapper: tracks `selectedCursor.screen` (projected each frame) so the popup follows the object as the camera moves. Exposes `DataRow`. |
| `src/components/ObjectPopup.tsx` | Bounding-box detail popup (uses `InfoPanelPopup`). |
| `src/components/ThreatPopup.tsx` | Analyzed threat position popup. |
| `src/components/PlacedUnitPopup.tsx` | Operator-placed enemy/friendly unit popup. |
| `src/engine/Viewer.ts` | Imperative three.js world. Owns renderer, scene graph, OrbitControls, point cloud, semantic boxes, observer marker, range ring, placed unit markers/rings, selection, keyboard movement, layer visibility, color-mode switching (rgb/height/temperature/viewshed/threat/danger/depth), and cursor-screen projection. Caches the cloud per page load. |
| `src/lib/api.ts` | Typed fetch helpers for required/optional API data. Relative URLs (Vite proxy in dev, same-origin in prod). Covers units CRUD, recompute/reset, danger/depth/viewshed bins. |
| `src/lib/store.ts` | Zustand app state: metadata, boxes, viewshed/threat/fields info + readiness flags, loading/error, color mode, overlay-on-rgb, layers, class visibility, selected box/threat/unit, placing/removing modes, active side/unit type, units list, unit profiles, scanning. Async actions for place/remove/clear units. |
| `src/lib/types.ts` | Shared TS interfaces mirroring the backend: `CloudMeta`, `BoundingBox`, `ViewshedInfo`, `UnitProfile`/`UnitContact`/`PlaceUnitRequest` (mirror of `units.py`), `ThreatInfo`/`ThreatPosition`, `FieldsInfo`, color modes, layer keys. |
| `src/lib/colors.ts` | Class colors and Turbo colormap. Tactical palette tokens are in Tailwind config. |
| `src/lib/utils.ts` | `w2v()` coordinate mapping from UTM world space to viewer space. |
| `src/index.css` | Tailwind base/components. Defines `.panel`, `.hud-text`, `.eyebrow`, `.skeleton-bar`, `.skip-link`. |

## Data — `data/`

Expected files are `point_cloud.ply` and `bounding_boxes.json`. They are large or
sensitive and gitignored. `data/README.md` documents the drop-in requirement.

## Docs — `docs/`

| File | Content |
|------|---------|
| `challange.md` / `CHALLENGE.md` | EDTH/SE3 challenge brief and chosen Track 1 direction. |
| `data.md` / `DATA.md` | Parsed dataset facts and implications. |
| `THREAT_LIBRARY.md` | OPFOR asset model, sensor/weapon envelopes, proposed `enemy_assets.json`. |
| `MANEUVER_ANALYSIS.md` | Blue COA concept: O/D/I/C/K/T layers, risk, routes, operator outputs. |
| `architecture.md`, `module-map.md`, `conventions.md`, `current-focus.md` | Team/agent context copies under `docs/`; `.docs/` is the injected source of truth. |
| `repo-context.md` | Stale older repomix dump; `.docs/repo-context.md` is the current generated one. |

## Run / Build

- `./run.sh` starts FastAPI through uvicorn and the Vite dev server using ports from `src/config.json`.
- `uv run python src/backend/visibility.py` optionally generates the viewshed overlay consumed by `/api/viewshed*` and the frontend.
- `uv run python src/backend/fields.py` regenerates the threat fields (also triggered at runtime by `POST /api/threat/recompute`).
- `npm --prefix src/frontend run build` runs TypeScript checks and a Vite production build.

`src/frontend/.vite/` appeared in the generated repomix output but is a generated
Vite cache, not source architecture.
