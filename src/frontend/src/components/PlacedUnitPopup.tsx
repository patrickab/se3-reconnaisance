import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'

export default function PlacedUnitPopup() {
  const selectedUnitId = useStore((s) => s.selectedUnitId)
  const screen = useStore((s) => s.selectedCursor?.screen ?? null)
  const unit = useStore((s) => s.units.find((u) => u.id === selectedUnitId) ?? null)
  const selectUnit = useStore((s) => s.selectUnit)
  const removeUnit = useStore((s) => s.removeUnit)

  if (!unit) return null

  const isHostile = unit.side === 'hostile'
  const sideColor = isHostile ? 'text-tactical-danger' : 'text-blue-400'

  return (
    <InfoPanelPopup
      screen={screen}
      width={260}
      header={
        <>
          <div className={`text-sm font-semibold ${sideColor}`}>
            {unit.side.toUpperCase()} · {unit.label}
          </div>
          <div className="mt-0.5 text-xs text-tactical-muted">{unit.source} · {unit.weight_class}</div>
        </>
      }
      onClose={() => selectUnit(null)}
    >
      <div className="mt-3 border border-tactical-border/50 bg-tactical-bg/30 px-2.5">
        <DataRow k="Confidence"  v={`${Math.round(unit.confidence * 100)}%`} />
        <DataRow k="Age"         v={`${unit.sec_since_contact.toFixed(0)} s`} />
        <DataRow k="Azimuth"     v={unit.azimuth != null ? `${Math.round(unit.azimuth)}°` : 'unknown'} />
        <DataRow k="Obs arc"     v={`${unit.obs_arc}°`} />
        <DataRow k="Eff range"   v={`${unit.eff_range_m} m`} />
        <DataRow k="Max range"   v={`${unit.max_range_m} m`} />
        <DataRow k="Height AGL"  v={`${unit.height_agl_m} m`} />
        <DataRow k="Easting"     v={unit.world[0].toFixed(0)} />
        <DataRow k="Northing"    v={unit.world[1].toFixed(0)} />
      </div>
      <button
        onClick={() => removeUnit(unit.id)}
        className={`mt-2 w-full border px-2 py-1 text-[11px] ${isHostile ? 'border-tactical-danger text-tactical-danger' : 'border-[#3b82f6] text-[#5b9dff]'} hover:text-tactical-text`}
      >
        remove contact
      </button>
    </InfoPanelPopup>
  )
}
