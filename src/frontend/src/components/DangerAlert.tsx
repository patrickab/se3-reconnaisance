import { useStore } from '../lib/store'
import { RiskZone, SoldierExposure } from '../lib/types'

// Top-centre alert: the instant a newly-spotted enemy puts a placed soldier in a kill/high/moderate
// zone, this pops. Driven by fields.json `soldiers` (auto-refreshed on every laydown change), so no
// button press — spot the enemy, the warning appears.

const ZONE_LABEL: Record<RiskZone, string> = {
  kill_zone: 'KILL ZONE', high: 'HIGH', moderate: 'MODERATE', low: 'clear',
}
const RANK: Record<RiskZone, number> = { kill_zone: 3, high: 2, moderate: 1, low: 0 }

export default function DangerAlert() {
  const fields = useStore((s) => s.fieldsInfo)
  const soldiers: SoldierExposure[] = fields?.soldiers ?? []
  if (!soldiers.length) return null   // no friendlies placed → nothing to warn about

  const atRisk = soldiers.filter((s) => s.zone !== 'low')
  if (!atRisk.length) return null   // everyone clear → no banner (only warn when there's danger)
  const worst = atRisk.reduce<RiskZone>((w, s) => (RANK[s.zone] > RANK[w] ? s.zone : w), 'low')
  const urgent = worst === 'kill_zone' || worst === 'high'   // kill/high = DANGER; moderate = caution

  // breakdown counts by zone, worst first
  const counts = (['kill_zone', 'high', 'moderate'] as RiskZone[])
    .map((z) => ({ z, n: atRisk.filter((s) => s.zone === z).length }))
    .filter((c) => c.n > 0)

  const tone = urgent
    ? 'border-tactical-danger bg-tactical-danger/15 text-tactical-danger'
    : 'border-tactical-warning/70 bg-tactical-warning/10 text-tactical-warning'

  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2">
      <div className={`panel rounded-xl shadow-lg ${tone} px-5 py-2 text-center ${urgent ? 'animate-pulse' : ''}`}>
        <div className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
          {urgent ? '⚠ ' : ''}{atRisk.length} soldier{atRisk.length > 1 ? 's' : ''} {urgent ? 'in danger' : 'at risk'}
        </div>
        <div className="mt-0.5 font-mono text-[11px] opacity-90">
          {counts.map((c) => `${c.n} ${ZONE_LABEL[c.z]}`).join(' · ')}
        </div>
      </div>
    </div>
  )
}
