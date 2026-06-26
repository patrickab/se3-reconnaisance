import { useStore } from '../lib/store'

export default function Hud() {
  const { meta, boxes } = useStore()
  if (!meta) return null
  return (
    <div className="absolute top-4 left-4 panel px-3 py-2 font-mono pointer-events-none">
      <div className="text-tactical-accent text-xs font-semibold tracking-wide">SE3 TACTICAL INTELLIGENCE</div>
      <div className="text-[11px] text-tactical-secondary mt-0.5">
        {meta.span[0].toFixed(0)} × {meta.span[1].toFixed(0)} m · {meta.n.toLocaleString()} pts · {boxes.length} objects
      </div>
      <div className="text-[10px] text-tactical-secondary/60 mt-1">WASD move · Q/E altitude · arrows look · scroll zoom</div>
    </div>
  )
}
