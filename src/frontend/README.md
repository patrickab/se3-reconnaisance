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
