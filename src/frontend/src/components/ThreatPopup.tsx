import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'

const LABEL: Record<ThreatType, string> = {
  sniper_op: 'Sniper / OP',
  tank: 'Tank / anti-armor',
  mortar: 'Mortar (indirect)',
}

/** Details for a clicked enemy position (threat-template output). */
export default function ThreatPopup() {
  const p = useStore((s) => s.selectedThreat)
  const pt = useStore((s) => s.selectedThreatPoint)
  const selectThreat = useStore((s) => s.selectThreat)
  if (!p) return null

  const width = 300
  const x = pt ? Math.min(pt.x + 12, window.innerWidth - width - 12) : 16
  const y = pt ? Math.min(pt.y + 12, window.innerHeight - 240) : window.innerHeight - 280

  return (
    <div className="absolute z-20 panel px-4 py-3" style={{ left: Math.max(12, x), top: Math.max(12, y), width }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-tactical-danger">ENEMY · {LABEL[p.type]}</div>
          <div className="mt-1 text-xs text-tactical-muted">{p.id} · likely position</div>
        </div>
        <button
          onClick={() => selectThreat(null)}
          className="-mr-1 -mt-1 px-2 py-1 text-sm text-tactical-muted hover:text-tactical-text"
          aria-label="Close threat details"
        >
          x
        </button>
      </div>

      <div className="mt-3">
        <Row k="Likelihood" v={`${Math.round(p.score * 100)}%`} />
        {p.role === 'indirect' ? (
          <Row k="Defilade" v={`${p.defilade_m} m behind mask`} />
        ) : (
          <Row k="Sees approach" v={`${p.sees_pct_of_approach}%`} />
        )}
        <Row k="Cover" v={`${p.cover_dist_m} m`} />
        <Row k="Height AGL" v={`${p.height_above_ground_m} m`} />
        <Row k="Thermal cue" v={p.thermal_cue.toFixed(2)} />
        <Row k="Grid" v={`${p.world[0].toFixed(0)} ${p.world[1].toFixed(0)}`} />
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="data-row">
      <span className="text-tactical-muted">{k}</span>
      <span className="text-right text-tactical-text">{v}</span>
    </div>
  )
}
