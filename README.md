# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction: turn labeled geometry into the
> judgments an operator needs — *where is the enemy likely to approach, where do
> I have field of fire, where am I exposed* — fast and legible.

See [`docs/CHALLENGE.md`](docs/CHALLENGE.md) for the challenge brief and
[`docs/DATA.md`](docs/DATA.md) for exactly what's in the dataset (inspected, not assumed).

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

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [ ] Derived ground + vegetation layer from the cloud (cover vs concealment)
- [ ] **Track 1** viewshed / field-of-fire engine (terrain + box occluders)
- [ ] Exposure / concealment map, approach-route cost surface, chokepoints
- [ ] Enemy-perspective viewshed (drop a pin → what they see & threaten)

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh prep` after you drop the data in.
