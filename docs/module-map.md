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
│   │   ├── visibility.py         vectorized radial LOS viewshed
│   │   ├── units.py              doctrinal unit catalog + weapon realism (single source of truth)
│   │   ├── threat_template.py    operator-placed enemies -> build/threat.json laydown
│   │   ├── fields.py             per-target-class fires/observation projection
│   │   ├── README.md             backend notes and roadmap
│   │   └── scripts/
│   │       └── inspect_ply.py    data sanity-check CLI
│   ├── frontend/                 React/Vite/three.js tactical UI
│   │   ├── public/
│   │   │   └── assets/           unit GLB models (tank, ifv, apc, assault, sniper, mortar, at_team, atgm_team)
│   │   ├── src/
│   │   │   ├── components/       HUD, panels, popups, alert, spinner, canvas mount
│   │   │   ├── engine/           imperative three.js viewer
│   │   │   ├── lib/              API, store, types, colors, utils
│   │   │   ├── App.tsx           root layout
│   │   │   ├── index.css         Tailwind layers/component classes
│   │   │   └── main.tsx          React entrypoint
│   │   ├── index.html            Vite HTML shell
│   │   ├── package.json          npm scripts/deps (three, milsymbol, lucide-react, zustand)
│   │   ├── tailwind.config.js    tactical color tokens
│   │   └── vite.config.ts        Vite + API proxy config
│   └── config.json               shared backend/frontend ports + cloud + fires settings
├── docs/                         project/domain docs
├── .docs/                        agent context summaries + generated repomix dump
├── pyproject.toml                Python package/deps/ruff config
└── run.sh                        starts backend and frontend dev servers
```

## Backend — `src/backend/`

| File | Responsibility |
|------|----------------|
| `io.py` | **Zero-copy PLY reader.** `read_ply(path)` memory-maps binary little-endian PLY vertex data into a numpy structured array. The dtype is built from the header, so added properties are picked up automatically. |
| `app.py` | **FastAPI server.** On startup `pack_cloud()` voxel-downsamples the PLY, recenters to local origin, adds sub-voxel horizontal jitter, and stores packed bytes in RAM; lifespan also `clear_laydown()`s so each session starts blank. Holds an in-memory `UNITS` contact store. Endpoints below. Reads shared settings from `src/config.json`; CORS for the Vite dev server. |
| `terrain.py` | **DSM builder.** `build_dsm()` creates a max-height grid from the cloud, rasterizes the 58 oriented boxes as solid occluders, nearest-fills gaps, and returns the DSM + transform + bounds + EPSG (caches `build/dsm.tif`). Helpers: `box_yaw`, `box_polygon`, `world_to_pixel`, `save_geotiff`. |
| `visibility.py` | **Viewshed engine.** `viewshed()` computes vectorized radial line-of-sight from an observer on the DSM using range, arc, facing, eye height, target height. Auto-places the default observer on a roof edge. Writes `build/viewshed.{tif,bin,json}` for the optional LOS overlay. |
| `units.py` | **Doctrinal unit catalog + weapon realism.** `Unit` (static type def) + `UnitContact` (placed instance) + `PlaceUnitRequest`/`UpdateUnitRequest` (POST/PATCH bodies). `UNIT_CATALOG` covers 8 types (tank/ifv/apc/assault/sniper/mortar/at_team/atgm_team) with `weight_class`, `role`, `fire_kind`, **`obs_arc` (observation) + `weapon_arc` (lethal sector)**, eff/max/min range, **Hill `p_hit` params (`ph_p0`/`ph_shoulder`/`ph_beta`)**, suppression `supp_s0`, and **per-target-class `eff{dismount,light_veh,armour}`** (P(kill\|hit)). Adds the `TargetClass` enum + `TARGET_HEIGHT_M`. `resolve_unit()` handles the legacy `sniper_op` alias; `unit_profiles()` feeds `GET /api/unit-profiles`. Single source of truth for both the analysis chain and the frontend. |
| `threat_template.py` | **Enemy laydown builder.** `from_manual(enemies, friendly)` turns operator-placed enemies into `build/threat.json`, converting each operator heading to a viewshed facing (`facing_deg = 90 - azimuth`); indirect units get no sector of fire. Friendlies become the `avenue` points and set `avenue_source = 'operator'` (the frontend's reveal gate). Per-type arc/role come from the unit catalog. Not auto-templated — operator provides ground truth. |
| `fields.py` | **Per-target-class fires/observation projection.** `run(side, res)` reads `build/threat.json` and projects, for each of dismount/light_veh/armour: direct-fire `P(kill)` (viewshed once at the obs arc, masked to the weapon arc; Hill `p_hit` × `eff[class]`, union over shooters with intel confidence + `exposure_shots`), **engagement depth** (crossfire, >=2 overlap), **indirect** (mortar annulus ∩ observed/TRP), continuous routing **danger** cost (cover-credited), true **pfatal** (marginal P(lethal fire)), **reason** (0 out-of-range / 1 dead-ground / 2 cover / 3 exposed), **conf**, **suppress**, and **per-soldier exposure zones**. Uses a per-shooter viewshed cache + the API's DSM/cloud caches. Writes `fields_cost_<class>.tif`, `fields_depth.tif`, per-class `{danger,pfatal,depth,reason,conf,suppress}_<class>.bin`, and `fields.json`. |
| `scripts/inspect_ply.py` | Prints PLY header, axis stats, color uniqueness sample, and elevation percentiles for sanity checks. |

### API endpoints (`app.py`)

| Method · Path | Purpose |
|---------------|---------|
| `GET /api/meta` · `GET /api/cloud` · `GET /api/boxes` | cloud metadata, packed point bytes, object boxes |
| `GET /api/viewshed` · `POST /api/viewshed` · `GET /api/viewshed-info` | precomputed LOS bin / recompute at a cursor / params |
| `GET /api/threat` · `GET /api/threat-info` | laydown bin / `threat.json` |
| `GET /api/danger` · `/pfatal` · `/depth` · `/reason` · `/conf` · `/suppress` | per-point analysis surfaces; each takes `?class=` (dismount\|light_veh\|armour, default dismount) |
| `GET /api/fields-info` | `fields.json` (shooter count, depth, TRPs, exposure stats, `soldiers`, per_class) |
| `GET /api/units?side=` · `GET /api/unit-profiles` | contact store (side-filtered) / doctrinal catalog |
| `POST /api/units` · `PATCH /api/units/{id}` · `DELETE /api/units/{id}` · `DELETE /api/units?side=` | place / move-reorient / delete / clear units |
| `POST /api/threat/recompute` · `POST /api/threat/reset` | build laydown + project fields / wipe back to blank |

Planned backend modules still live conceptually after `fields.py`: `routes.py`
for least-cost maneuver outputs and `landcover.py` for a vegetation/concealment
mask separate from hard cover.

## Frontend — `src/frontend/`

| File | Responsibility |
|------|----------------|
| `src/App.tsx` | Root full-screen tactical layout. Renders `SceneCanvas`, `Hud`, `FriendlyPanel`, `DangerAlert`, `AnalyzingSpinner`, `ObjectPopup`, `ThreatPanel`, `ThreatPopup`, `PlacedUnitPopup`, and loading/error overlays. |
| `src/components/SceneCanvas.tsx` | Mounts the three.js engine once and forwards Zustand store changes into it. **Auto-projects** the fields on every laydown change (debounced, single-flight `postRecompute`), polls `/api/units` every 2 s to pick up API-side changes, runs the cursor-LOS POST in viewshed mode, and handles ESC to cancel place/move/remove. |
| `src/components/Hud.tsx` | Top-left panel: base map modes (RGB / Height) + **Battlefield Analysis** surfaces (**Risk Classification** = `risk`, **Crossfire Indicator** = `depth`, **Probability of Lethal Fire** = `pfatal`, gated on `fieldsReady`); a **"risk for"** target-class toggle (Infantry/Light veh/Armour); the risk-band legend (matches `riskBand()`); and the object-class legend with Lucide icons + counts. |
| `src/components/FriendlyPanel.tsx` | Operator unit controls (top-right): ENEMY/ALLY side toggle, place/**move**/remove map modes, unit-type picker (from `/api/unit-profiles`), viewfields toggle, and "clear all" (`postReset` + `clearUnits`, then reload). No "analyse" button — projection is automatic. |
| `src/components/DangerAlert.tsx` | Tiered per-soldier danger banner (red `kill_zone` / orange `high` / yellow `moderate`) read from `fields.json` `soldiers`; expandable per-tier list with a "locate" control that flies the camera via `focusWorld`. |
| `src/components/AnalyzingSpinner.tsx` | Top-centre "Analysing threat" pill, shown while `scanning` (the only visible signal of the auto-recompute). |
| `src/components/ThreatPanel.tsx` | Ranked list of likely enemy positions from `/api/threat-info`, visible only in the `threat` color mode. |
| `src/components/InfoPanelPopup.tsx` | Generic anchor-following popup wrapper: tracks `selectedCursor.screen` (projected each frame) so the popup follows its subject as the camera moves. Exposes `DataRow`. |
| `src/components/ObjectPopup.tsx` | Bounding-box detail popup (uses `InfoPanelPopup`). |
| `src/components/ThreatPopup.tsx` | Analyzed threat position popup. |
| `src/components/PlacedUnitPopup.tsx` | Operator-placed enemy/friendly unit popup. |
| `src/components/Sidebar.tsx` | Legacy/unused — not imported anywhere in the current app. |
| `src/engine/Viewer.ts` | Imperative three.js world. Owns renderer, scene graph + lighting (hemisphere + directional sun), OrbitControls, point cloud, semantic boxes, **3D unit GLB models** (`GLTFLoader` + `MeshoptDecoder`) and **NATO symbols** (`milsymbol`), range rings, drag-to-place/move/remove, selection, layer visibility, `focusWorld()` camera fly-to, cursor-screen projection, and color-mode switching (rgb/height/temperature/viewshed/threat/depth/pfatal/risk). Holds per-target-class risk arrays (danger byte, depth, reason), re-fetched on `setRiskClass`, and bands them via `riskBand()`. |
| `src/lib/api.ts` | Typed fetch helpers. Relative URLs (Vite proxy in dev, same-origin in prod). Covers units CRUD + PATCH, recompute/reset, viewshed, and the per-class surface bins (`?class=`). |
| `src/lib/store.ts` | Zustand app state: metadata, boxes, viewshed/threat/fields info + readiness flags, color mode, `riskClass`, overlay-on-rgb, layers, class visibility, selections, placing/**moving**/removing modes, active side/unit type, units list, unit profiles, `scanning`, and `focusWorld` (set by SceneCanvas). Async actions: place/move/reorient/remove/clear units. |
| `src/lib/types.ts` | Shared TS interfaces mirroring the backend: `CloudMeta`, `BoundingBox`, `ViewshedInfo`, `UnitProfile`/`UnitContact`/`PlaceUnitRequest` (mirror of `units.py`), `ThreatInfo`/`ThreatPosition`, `FieldsInfo` with `SoldierExposure`/`RiskZone`, plus `ColorMode`/`LayerKey`/class-visibility types. |
| `src/lib/colors.ts` | Object-class colors (`CLASS_COLORS`) + the Google Turbo colormap (`TURBO`). Tactical palette tokens live in Tailwind config. |
| `src/lib/utils.ts` | `w2v()` / `v2w()` coordinate mapping between UTM world space and viewer space. |
| `src/index.css` | Tailwind base/components. Defines `.panel`, `.hud-text`, `.eyebrow`, `.skeleton-bar`, `.skip-link`, segmented/legend cell styles. |

## Data — `data/`

Expected files are `point_cloud.ply` and `bounding_boxes.json`. They are large or
sensitive and gitignored. `data/README.md` documents the drop-in requirement.

## Docs — `docs/`

| File | Content |
|------|---------|
| `challange.md` | EDTH/SE3 challenge brief and chosen Track 1 direction. |
| `data.md` | Parsed dataset facts and implications. |
| `ANALYSIS_LAYER.md` | Analysis-engine + unit/weapon-realism design notes (referenced by `units.py`/`fields.py`). |
| `THREAT_LIBRARY.md` | OPFOR asset model, sensor/weapon envelopes (partially stale — see `CLAUDE.md`). |
| `MANEUVER_ANALYSIS.md` | Blue COA concept: O/D/I/C/K/T layers, risk, routes, operator outputs (partially stale). |
| `architecture.md`, `module-map.md`, `conventions.md`, `current-focus.md` | Team/agent context copies under `docs/`; `.docs/` is the injected source of truth. |
| `repo-context.md` | Stale older repomix dump; `.docs/repo-context.md` is the current generated one. |

## Run / Build

- `./run.sh` starts FastAPI through uvicorn and the Vite dev server using ports from `src/config.json`.
- `uv run python src/backend/visibility.py` optionally generates the viewshed overlay consumed by `/api/viewshed*`.
- `uv run python src/backend/fields.py` regenerates the threat fields (also triggered at runtime by `POST /api/threat/recompute`, which the frontend fires automatically).
- `npm --prefix src/frontend run build` runs TypeScript checks and a Vite production build.

`src/frontend/.vite/` appeared in the generated repomix output but is a generated
Vite cache, not source architecture.
