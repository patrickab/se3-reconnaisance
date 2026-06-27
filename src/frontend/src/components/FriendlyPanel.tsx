import { postRecompute } from '../lib/api'
import { useStore } from '../lib/store'

/** Operator places friendly troops on the map; "scan" re-templates the enemy from them. */
export default function FriendlyPanel() {
  const placing = useStore((s) => s.placing)
  const friendly = useStore((s) => s.friendly)
  const scanning = useStore((s) => s.scanning)
  const setPlacing = useStore((s) => s.setPlacing)
  const clearFriendly = useStore((s) => s.clearFriendly)
  const setScanning = useStore((s) => s.setScanning)

  const scan = async () => {
    setScanning(true)
    try {
      await postRecompute(friendly)
      // the placed troops become the new avenue of approach on the backend —
      // reload to pull the freshly-templated enemy laydown + fields.
      window.location.reload()
    } catch {
      setScanning(false)
    }
  }

  return (
    <div className="absolute right-4 top-4 z-10 w-56 panel px-3 py-2 font-mono">
      <div className="text-[11px] font-semibold text-[#5b9dff]">FRIENDLY · place your troops</div>
      <button
        onClick={() => setPlacing(!placing)}
        className={`mt-2 w-full border px-2 py-1 text-left text-[11px] ${
          placing ? 'border-[#3b82f6] text-[#5b9dff]' : 'border-tactical-border text-tactical-secondary hover:text-tactical-text'
        }`}
      >
        {placing ? '● placing — click the map' : 'place troops'}
      </button>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-tactical-muted">{friendly.length} placed</span>
        <button
          onClick={clearFriendly}
          disabled={!friendly.length || scanning}
          className="border border-tactical-border px-2 py-0.5 text-[10px] text-tactical-secondary hover:text-tactical-text disabled:opacity-30"
        >
          clear
        </button>
      </div>
      <button
        onClick={scan}
        disabled={!friendly.length || scanning}
        className="mt-2 w-full border border-tactical-danger px-2 py-1 text-[11px] text-tactical-danger hover:text-tactical-text disabled:opacity-40"
      >
        {scanning ? 'scanning enemy… ~30 s' : '▶ scan enemy'}
      </button>
      <div className="mt-1.5 text-[9px] leading-snug text-tactical-muted">
        click the terrain to drop troop positions, then scan — the enemy re-templates from where you are.
      </div>
    </div>
  )
}
