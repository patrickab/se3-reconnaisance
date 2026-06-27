import { useStore } from '../lib/store'
import { RiskZone, SoldierExposure } from '../lib/types'

// Top-centre alert: the instant a newly-spotted enemy puts a placed soldier in a kill/high/moderate
// zone, this pops. Driven by fields.json `soldiers` (auto-refreshed on every laydown change), so no
// button press — spot the enemy, the warning appears. Single flat line + a jump-to-soldier link.

const RANK: Record<RiskZone, number> = { kill_zone: 3, high: 2, moderate: 1, low: 0 }

export default function DangerAlert() {
  const fields = useStore((s) => s.fieldsInfo)
  const focusWorld = useStore((s) => s.focusWorld)
  const soldiers: SoldierExposure[] = fields?.soldiers ?? []

  const atRisk = soldiers.filter((s) => s.zone !== 'low')
  if (!atRisk.length) return null   // everyone clear → no banner (only warn when there's danger)

  const worst = atRisk.reduce<RiskZone>((w, s) => (RANK[s.zone] > RANK[w] ? s.zone : w), 'low')
  const urgent = worst === 'kill_zone' || worst === 'high'   // kill/high = DANGER; moderate = caution

  // jump to the highest-risk soldier
  const target = atRisk.reduce((a, b) => (RANK[b.zone] > RANK[a.zone] ? b : a))
  const tone = urgent ? 'text-tactical-danger' : 'text-tactical-warning'

  return (
    <div className="absolute left-1/2 top-14 z-30 -translate-x-1/2">
      <div className={`flex items-center gap-1.5 border border-tactical-border bg-tactical-panel px-4 py-2 font-mono text-sm ${tone}`}>
        <span className="font-semibold uppercase tracking-[0.1em]">
          {urgent ? 'Danger' : 'Caution'}: {atRisk.length} soldier{atRisk.length > 1 ? 's' : ''} {urgent ? 'in danger' : 'at risk'}
        </span>
        <button
          onClick={() => focusWorld?.(target.world)}
          className="underline decoration-1 underline-offset-2 opacity-80 hover:opacity-100"
        >
          locate
        </button>
      </div>
    </div>
  )
}
