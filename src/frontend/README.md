# Frontend — 3D viewer

Interactive viewer for the point cloud + semantic object boxes. Static
`index.html` (three.js via CDN) — no build step.

## Run

```bash
./run.sh                 # http://localhost:8011 (FastAPI serves viewer + data)
```

The FastAPI backend packs the cloud on startup and serves it — no separate build
step, no generated `public/`. Data fetched from `api/{meta,cloud,boxes}`, and the
viewshed overlay from `api/viewshed{,-info}` when present.

## Controls

- **drag** orbit · **scroll** zoom · **right-drag** pan · **click a box** → details
- **points:** RGB / height-coloured / **viewshed** · **objects:** colour by class / by thermal
- per-class show/hide (legend), point size, box-fill opacity, edges/cloud toggles
- true 1:1 scale (no vertical exaggeration), 100 m grid, north arrow
- **viewshed** mode (red = seen by enemy OP, green = dead ground) needs
  `uv run python src/backend/visibility.py` first; otherwise the button is disabled

## Notes

- Coordinates are recentered to a local origin (served in `api/meta`; UTM doubles
  exceed float32 precision, so the browser works in metres from that origin).
- Frame mapping: east → X, elevation → Y (up), north → −Z.
- three.js is loaded from a CDN, so the browser needs internet on first load.
