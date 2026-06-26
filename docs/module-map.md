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
