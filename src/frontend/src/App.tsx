import { useStore } from './lib/store'
import SceneCanvas from './components/SceneCanvas'
import Hud from './components/Hud'
import ObjectPopup from './components/ObjectPopup'

export default function App() {
  const error = useStore((s) => s.error)
  const loading = useStore((s) => s.loading)

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-tactical-bg text-tactical-text">
      <main className="relative min-w-0 flex-1" aria-label="3D tactical scene">
        <SceneCanvas />
        <Hud />
        <ObjectPopup />
        {loading && !error && (
          <div className="absolute left-4 top-4 z-20 panel px-3 py-2 font-mono text-xs text-tactical-secondary">
            Loading scene...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-tactical-bg/80 p-6 text-center">
            <div className="panel max-w-md p-5">
              <div className="text-sm font-semibold text-tactical-danger">Data link unavailable</div>
              <div className="mt-2 text-sm text-tactical-text">{error}</div>
              <div className="mt-3 text-xs text-tactical-secondary">Backend is not reachable; the scene cannot be loaded.</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
