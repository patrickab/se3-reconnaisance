import { useStore } from '../lib/store'

/** Top-centre "Analysing threat" indicator shown while the fires/observation
 *  fields are being projected. Driven by the auto-recompute in SceneCanvas —
 *  analysis no longer rerenders the scene, so this pill is the only visible signal. */
export default function AnalyzingSpinner() {
  const scanning = useStore((s) => s.scanning)
  if (!scanning) return null
  return (
    <div
      className="absolute left-1/2 top-3 z-20 -translate-x-1/2 panel flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-tactical-secondary"
      role="status"
      aria-live="polite"
    >
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-tactical-border border-t-tactical-danger" />
      Analysing threat
    </div>
  )
}
