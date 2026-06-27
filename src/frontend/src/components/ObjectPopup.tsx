import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'

export default function ObjectPopup() {
  const selected = useStore((s) => s.selected)
  const screen = useStore((s) => s.selectedCursor?.screen ?? null)
  const select = useStore((s) => s.select)
  if (!selected) return null

  return (
    <InfoPanelPopup
      screen={screen}
      width={260}
      header={
        <>
          <div className="eyebrow">selected object</div>
          <div className="mt-1 font-mono text-sm font-semibold uppercase tracking-[0.08em] text-tactical-text">{selected.name}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-tactical-muted">{selected.class_label}</div>
        </>
      }
      onClose={() => select(null)}
    >
      <div className="mt-3 border border-tactical-border/50 bg-tactical-bg/30 px-2.5">
        <DataRow k="Size" v={`${selected.extent.map((x) => x.toFixed(1)).join(' x ')} m`} />
        <DataRow k="Thermal" v={`${selected.avg_temperature.toFixed(1)} °C`} accent={selected.avg_temperature >= 20 ? 'warning' : undefined} />
        <DataRow k="Easting" v={selected.center[0].toFixed(1)} />
        <DataRow k="Northing" v={selected.center[1].toFixed(1)} />
        <DataRow k="Elevation" v={`${selected.center[2].toFixed(1)} m`} />
      </div>
    </InfoPanelPopup>
  )
}
