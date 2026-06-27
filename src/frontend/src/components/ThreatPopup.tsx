import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'

const LABEL: Record<ThreatType, string> = {
  sniper_op: 'Sniper / OP',
  tank: 'Tank / anti-armor',
  mortar: 'Mortar (indirect)',
}

export default function ThreatPopup() {
  const p = useStore((s) => s.selectedThreat)
  const pt = useStore((s) => s.selectedThreatPoint)
  const selectThreat = useStore((s) => s.selectThreat)
  if (!p) return null

  return (
    <InfoPanelPopup
      screen={pt}
      width={300}
      header={
        <>
          <div className="text-sm font-semibold text-tactical-danger">ENEMY · {LABEL[p.type]}</div>
          <div className="mt-1 text-xs text-tactical-muted">{p.id} · likely position</div>
        </>
      }
      onClose={() => selectThreat(null)}
    >
      <div className="mt-3">
        <DataRow k="Likelihood" v={`${Math.round(p.score * 100)}%`} />
        {p.role === 'indirect' ? (
          <DataRow k="Defilade" v={`${p.defilade_m} m behind mask`} />
        ) : (
          <DataRow k="Sees approach" v={`${p.sees_pct_of_approach}%`} />
        )}
        <DataRow k="Cover" v={`${p.cover_dist_m} m`} />
        <DataRow k="Height AGL" v={`${p.height_above_ground_m} m`} />
        <DataRow k="Thermal cue" v={p.thermal_cue.toFixed(2)} />
        <DataRow k="Grid" v={`${p.world[0].toFixed(0)} ${p.world[1].toFixed(0)}`} />
      </div>
    </InfoPanelPopup>
  )
}
