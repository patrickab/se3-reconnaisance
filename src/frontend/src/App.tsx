import { useStore } from './lib/store'
import SceneCanvas from './components/SceneCanvas'
import Hud from './components/Hud'
import ObjectPopup from './components/ObjectPopup'
import ThreatPanel from './components/ThreatPanel'
import ThreatPopup from './components/ThreatPopup'

export default function App() {
  const error = useStore((s) => s.error)
  const loading = useStore((s) => s.loading)

  return (
    <div className="app-shell flex h-dvh w-screen overflow-hidden text-tactical-text">
      <a className="skip-link" href="#scene-viewer">
        Skip to scene
      </a>
      <main id="scene-viewer" className="relative min-w-0 flex-1" aria-label="3D tactical scene" tabIndex={-1}>
        <SceneCanvas />
        <div className="noise-overlay" aria-hidden="true" />
        <div className="scene-vignette" aria-hidden="true" />
        <Hud />
        <ObjectPopup />
        <ThreatPanel />
        <ThreatPopup />
        {loading && !error && (
          <div className="absolute left-4 top-4 z-20 panel w-[min(19rem,calc(100vw-2rem))] px-4 py-4 text-sm text-tactical-secondary">
            <div className="eyebrow">SE3 Recon</div>
            <div className="mt-2 text-lg font-semibold leading-tight tracking-[-0.03em] text-tactical-text">Ingesting battlefield scan</div>
            <div className="mt-3 space-y-2" aria-hidden="true">
              <div className="skeleton-bar h-2 w-11/12" />
              <div className="skeleton-bar h-2 w-8/12" />
              <div className="skeleton-bar h-2 w-10/12" />
            </div>
            <div className="mt-3 font-mono text-xs text-tactical-muted">Waiting for FastAPI metadata, boxes, and optional viewshed layer.</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-tactical-bg/80 p-6 text-left">
            <div className="panel max-w-md p-6">
              <div className="eyebrow text-tactical-danger">Data link unavailable</div>
              <div className="mt-3 text-2xl font-semibold leading-none tracking-[-0.04em] text-tactical-text">We could not load the scene</div>
              <div className="mt-4 rounded-xl border border-tactical-danger/40 bg-tactical-danger/10 px-3 py-2 font-mono text-xs text-tactical-text">{error}</div>
              <div className="mt-4 text-sm leading-6 text-tactical-secondary">Start the backend and confirm `/api/meta` responds before using the viewer.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
