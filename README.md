# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction. The operator marks the enemy from
> intel; the system projects what they threaten — *fields of fire, kill zones,
> where am I exposed* — fast and legible. It is **operator-driven**: place the
> enemy, the threat is computed (no auto-templating).

Docs:
- [`docs/challange.md`](docs/challange.md) — the challenge brief & our direction
- [`docs/data.md`](docs/data.md) — exactly what's in the dataset (inspected, not assumed)
- [`docs/ANALYSIS_LAYER.md`](docs/ANALYSIS_LAYER.md) — the analysis engine: unit/weapon realism, per-target-class risk
- [`docs/THREAT_LIBRARY.md`](docs/THREAT_LIBRARY.md) — the unit/weapon model: per-type observation + weapon envelopes (`units.py`)
- [`docs/MANEUVER_ANALYSIS.md`](docs/MANEUVER_ANALYSIS.md) — Blue course of action: threat maps, covered approach, suppression priority, go/no-go

## Repo layout

```
.
├── data/                 # provided inputs — gitignored (get from the SE3 mentor)
│   ├── point_cloud.ply   #   ~4M-point cloud, XYZ (UTM, metres) + RGB
│   └── bounding_boxes.json#   58 oriented object boxes + thermal signature
├── src/
│   ├── config.json       # shared backend/frontend ports + cloud voxel/max_points
│   ├── backend/          # Python: data IO + FastAPI server + tactical analysis
│   │   ├── io.py         #   PLY reader (memmap, zero-copy)
│   │   ├── app.py        #   FastAPI: packs cloud on startup, serves /api/*, /threat/recompute
│   │   ├── terrain.py    #   DSM from cloud + boxes as occluders (build/dsm.tif)
│   │   ├── visibility.py #   line-of-sight viewshed (the core primitive)
│   │   ├── units.py      #   UNIT_CATALOG — single source of truth for the 8 unit types
│   │   ├── threat_template.py # build threat.json from operator-placed enemies
│   │   ├── fields.py     #   project laydown → kill zones / danger / P(fatal), per target class
│   │   └── scripts/      #   inspect_ply.py (data sanity-check)
│   └── frontend/         # React + Vite + TypeScript + Tailwind + zustand; raw three.js
│       ├── src/
│       │   ├── engine/   #   Viewer.ts — the three.js world (cloud, boxes, markers, overlays, GLB unit models)
│       │   ├── components/ # SceneCanvas, Hud, Sidebar, FriendlyPanel, DangerAlert, *Popup
│       │   └── lib/      #   api.ts, store.ts (zustand), types.ts, colors.ts, utils.ts
│       ├── public/assets/#   per-type .glb unit models (tank, ifv, sniper, …) — gitignored
│       ├── package.json  #   React, Vite, three.js, TailwindCSS, zustand
│       └── index.html    #   vite entry
├── build/                # generated layers (DSM/viewshed/threat/danger/fields) — gitignored
├── docs/                 # challenge brief + data findings + analysis-layer notes
├── pyproject.toml        # uv / hatchling project (ruff configured)
└── run.sh                # ./run.sh → uvicorn (:8011) + vite (:5173)
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

# 5. (optional) build the interactive-LOS viewshed overlay
uv run python src/backend/visibility.py   # writes build/viewshed.*
```

The app lives at <http://localhost:5173> (Vite); it proxies `/api` to the FastAPI
backend on `:8011` (the backend serves data, not the UI). Inspect the raw cloud
any time with:

```bash
uv run python src/backend/scripts/inspect_ply.py
```

## The viewer

True 1:1 scale (no vertical exaggeration). Opens **blank** — terrain point cloud
(RGB / height-coloured) plus all 58 oriented object boxes (per-class show/hide,
click any box for its dimensions / temperature / UTM position). North arrow +
100 m grid for scale.

**Operator-driven placement.** Pick a unit type, click the map to drop each enemy
(rendered as a 3D `.glb` model with its sector of fire); optionally place friendly
positions. The threat **auto-projects** whenever the laydown changes — no manual
"analyse" button, no page reload (debounced, single-flight in `SceneCanvas`).

Analysis surfaces (enabled once a laydown exists), each selectable **per target
class** — Infantry / Light veh / Armour:
- **Risk Classification** — the continuous danger cost (kill zone → dead ground →
  cover → out of range), with a colour legend.
- **Crossfire Indicator** — engagement-area depth (≥ 2 = mutually-supporting kill
  zone).
- **Probability of Lethal Fire** — the true P(fatal) surface (`pfatal`).

A **danger-alert** banner warns the instant a placed friendly is exposed by the
current laydown, grouped by tier (kill zone / high / moderate) with a locate
button. An interactive **LOS** viewshed (drop a point → what's visible) is
available after `visibility.py` has run.

## Status / roadmap

The operator marks the enemy from intel; the system projects what they threaten.
The spine is one primitive — the **viewshed** — because observation gates
lethality (direct fire: a weapon sees you; indirect fire: an observer sees you).
See the docs above.

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [x] Terrain DSM from the cloud + the 58 boxes as occluders (`terrain.py`)
- [x] **Viewshed / line-of-sight engine** (`visibility.py`) + interactive LOS — core
- [x] **Operator-driven manual placement** of enemy/friendly units (`/api/units`)
- [x] Unit/weapon realism — 8 types, two-arc model, per-class lethality (`units.py`)
- [x] Threat projection: kill zones, danger, P(fatal), sectors of fire, TRPs (`fields.py`)
- [x] Per-target-class risk surfaces (dismount / light vehicle / armour)
- [x] Auto-project on laydown change + soldier danger-alert banner
- [x] 3D unit models in the scene (per-type `.glb`)
- [ ] Vegetation / concealment layer from the cloud (cover vs concealment, `landcover.py`)
- [ ] Covered-approach / exposure routing — "how do I get there alive" (`routes.py`)
- [ ] Scan speed — cache the DSM across recomputes

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh` after you drop the data in.
