# SE3 Tactical Intelligence — Frontend

Modern React + Vite application for battlefield intelligence visualization.

## Stack

- **React 18** + **TypeScript** — component framework
- **Vite** — build tool (instant HMR, fast builds)
- **TresJS** → three.js — 3D scene
- **Radix UI** — accessible headless components
- **TailwindCSS** — styling, dark theme
- **Zustand** (ready to add) — global state

## Development

```bash
# Install deps
npm install

# Start dev server (HMR at localhost:5173, proxies /api to :8011)
npm run dev

# Build for production
npm run build

# Preview built app
npm run preview
```

## Architecture

```
src/
├── app/
│   ├── AppContent.tsx    (main layout)
│   └── layout.css
├── components/           (React components)
│   ├── SceneViewer.tsx   (three.js canvas)
│   ├── ControlPanel.tsx  (UI controls)
│   ├── ThreatPanel.tsx   (threat details)
│   └── LayerStack.tsx    (layer toggles)
├── contexts/            (React Context for state)
│   └── ViewerContext.tsx
├── hooks/               (custom hooks)
│   └── useScene.ts      (load scene data)
├── lib/
│   ├── api.ts           (FastAPI fetch calls)
│   ├── types.ts         (TypeScript interfaces)
│   ├── colors.ts        (tactical palette)
│   └── utils.ts         (helpers)
├── App.tsx              (root)
└── main.tsx             (entry)
```

## Features

- **Real-time 3D viewer** — point cloud + semantic boxes, true 1:1 scale
- **Multiple colormodes** — RGB / height / viewshed overlay
- **Layer toggles** — show/hide cloud, boxes, viewshed
- **Threat details** — click boxes to inspect
- **Keyboard shortcuts** — V=viewshed, L=layers, T=threats
- **Dark tactical UI** — command center aesthetic

## Next Steps

- [ ] TresJS integration (Vue wrapper, replace three.js direct calls)
- [ ] Keyboard handler hook (useKeyboard)
- [ ] Threat placement UI
- [ ] Route visualization
- [ ] Risk map heatmap overlay
- [ ] Go/No-Go readout panel

## Env

`VITE_API_URL` — FastAPI base URL (default: localhost:8011)
