import { postRecompute, postReset } from '../lib/api'
import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'

const TYPES: { key: ThreatType; label: string }[] = [
  { key: 'sniper_op', label: 'Sniper/OP' },
  { key: 'tank', label: 'Tank' },
  { key: 'mortar', label: 'Mortar' },
]

/** Operator marks the enemy from intel, then analyses what they threaten. */
export default function FriendlyPanel() {
  const placing = useStore((s) => s.placing)
  const enemyType = useStore((s) => s.enemyType)
  const enemies = useStore((s) => s.enemies)
  const friendly = useStore((s) => s.friendly)
  const scanning = useStore((s) => s.scanning)
  const hasLaydown = useStore((s) => s.threatInfo !== null) // an analysed laydown is on the map
  const setPlacing = useStore((s) => s.setPlacing)
  const setEnemyType = useStore((s) => s.setEnemyType)
  const clearEnemies = useStore((s) => s.clearEnemies)
  const clearFriendly = useStore((s) => s.clearFriendly)
  const setScanning = useStore((s) => s.setScanning)

  const analyze = async () => {
    setScanning(true)
    try {
      await postRecompute(enemies, friendly)
      window.location.reload() // pull the freshly-projected fields of fire / kill zones
    } catch {
      setScanning(false)
    }
  }

  // Wipe the analysed laydown so the battlefield goes blank again.
  const reset = async () => {
    setScanning(true)
    try {
      await postReset()
      window.location.reload()
    } catch {
      setScanning(false)
    }
  }

  return (
    <div className="absolute right-4 top-4 z-10 w-60 panel px-3 py-2 font-mono">
      <div className="text-[11px] font-semibold text-tactical-danger">ENEMY · place from intel</div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setEnemyType(t.key)}
            className={`border px-1 py-1 ${enemyType === t.key ? 'border-tactical-danger text-tactical-danger' : 'border-tactical-border text-tactical-secondary hover:text-tactical-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => setPlacing(placing === 'enemy' ? null : 'enemy')}
        className={`mt-1.5 w-full border px-2 py-1 text-left text-[11px] ${placing === 'enemy' ? 'border-tactical-danger text-tactical-danger' : 'border-tactical-border text-tactical-secondary hover:text-tactical-text'}`}
      >
        {placing === 'enemy' ? '● placing enemy — click the map' : 'place enemy'}
      </button>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[10px] text-tactical-muted">{enemies.length} enemy placed</span>
        <button onClick={clearEnemies} disabled={!enemies.length || scanning}
          className="border border-tactical-border px-2 py-0.5 text-[10px] text-tactical-secondary hover:text-tactical-text disabled:opacity-30">clear</button>
      </div>

      <div className="mt-2 border-t border-tactical-border/60 pt-2">
        <button
          onClick={() => setPlacing(placing === 'friendly' ? null : 'friendly')}
          className={`w-full border px-2 py-1 text-left text-[11px] ${placing === 'friendly' ? 'border-[#3b82f6] text-[#5b9dff]' : 'border-tactical-border text-tactical-secondary hover:text-tactical-text'}`}
        >
          {placing === 'friendly' ? '● placing our positions — click' : 'place our positions (optional)'}
        </button>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-[10px] text-tactical-muted">{friendly.length} friendly</span>
          <button onClick={clearFriendly} disabled={!friendly.length || scanning}
            className="border border-tactical-border px-2 py-0.5 text-[10px] text-tactical-secondary hover:text-tactical-text disabled:opacity-30">clear</button>
        </div>
      </div>

      <button
        onClick={analyze}
        disabled={!enemies.length || scanning}
        className="mt-2 w-full border border-tactical-danger px-2 py-1 text-[11px] text-tactical-danger hover:text-tactical-text disabled:opacity-40"
      >
        {scanning ? 'analysing… ~15 s' : '▶ analyse threat'}
      </button>
      {hasLaydown && (
        <button
          onClick={reset}
          disabled={scanning}
          className="mt-1.5 w-full border border-tactical-border px-2 py-1 text-[11px] text-tactical-secondary hover:text-tactical-text disabled:opacity-40"
        >
          ✕ clear battlefield
        </button>
      )}
      <div className="mt-1.5 text-[9px] leading-snug text-tactical-muted">
        mark the enemy from your intel (and our own positions), then analyse — fields of fire, kill zones and danger are projected from where they are.
      </div>
    </div>
  )
}
