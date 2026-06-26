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
