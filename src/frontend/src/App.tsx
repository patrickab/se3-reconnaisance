import { useStore } from './lib/store'
import SceneCanvas from './components/SceneCanvas'
import Sidebar from './components/Sidebar'
import Hud from './components/Hud'

export default function App() {
  const error = useStore((s) => s.error)

  return (
    <div className="w-screen h-screen flex bg-tactical-bg text-tactical-text overflow-hidden">
      <div className="relative flex-1">
        <SceneCanvas />
        <Hud />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <div className="text-tactical-danger font-semibold">Connection error</div>
              <div className="text-tactical-secondary text-sm mt-1">{error}</div>
              <div className="text-tactical-secondary/60 text-xs mt-3">Is the backend running on :8011?</div>
            </div>
          </div>
        )}
      </div>
      <Sidebar />
    </div>
  )
}
