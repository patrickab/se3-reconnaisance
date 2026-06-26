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
