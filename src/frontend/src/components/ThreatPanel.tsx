import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'

const ICON: Record<ThreatType, string> = { sniper_op: '◆', tank: '▮', mortar: '⬢' }
const NAME: Record<ThreatType, string> = { sniper_op: 'Sniper/OP', tank: 'Tank', mortar: 'Mortar' }

/** Ranked list of likely enemy positions; visible in Threat color mode. */
export default function ThreatPanel() {
  const info = useStore((s) => s.threatInfo)
  const mode = useStore((s) => s.colorMode)
  const selectThreat = useStore((s) => s.selectThreat)
  if (!info || mode !== 'threat') return null

  return (
    <div className="absolute bottom-4 left-4 z-10 w-[min(20rem,calc(100vw-2rem))] panel px-3 py-2 font-mono">
      <div className="text-[11px] font-semibold text-tactical-danger">THREAT TEMPLATE · likely enemy positions</div>
      <div className="mt-0.5 text-[10px] text-tactical-muted">
        approach from the {info.side} · {info.aa_points} sample points
      </div>
      <div className="mt-2 space-y-0.5">
        {info.positions.map((p, i) => (
          <button
            key={p.id}
            onClick={() => selectThreat(p)}
            className="flex w-full items-center justify-between gap-2 px-1 py-0.5 text-left text-[11px] text-tactical-secondary hover:text-tactical-text"
          >
            <span className="truncate">
              <span className="text-tactical-danger">{ICON[p.type]}</span> {i + 1}. {NAME[p.type]}
            </span>
            <span className="shrink-0 text-tactical-muted">
              {Math.round(p.score * 100)}% {p.role === 'indirect' ? `· def ${p.defilade_m}m` : `· sees ${p.sees_pct_of_approach}%`}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 text-[9px] text-tactical-muted">heat = how well a position dominates our approach</div>
    </div>
  )
}
