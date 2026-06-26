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
