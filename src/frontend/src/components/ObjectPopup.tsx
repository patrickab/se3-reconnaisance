import { useStore } from '../lib/store'

export default function ObjectPopup() {
  const selected = useStore((s) => s.selected)
  const selectedPoint = useStore((s) => s.selectedPoint)
  const select = useStore((s) => s.select)
  if (!selected) return null

  const width = 320
  const x = selectedPoint ? Math.min(selectedPoint.x + 12, window.innerWidth - width - 12) : 16
  const y = selectedPoint ? Math.min(selectedPoint.y + 12, window.innerHeight - 220) : window.innerHeight - 260

  return (
    <div className="absolute z-20 panel px-4 py-3" style={{ left: Math.max(12, x), top: Math.max(12, y), width }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-tactical-text">{selected.name}</div>
          <div className="mt-1 text-xs capitalize text-tactical-muted">{selected.class_label}</div>
        </div>
        <button
          onClick={() => select(null)}
          className="-mr-1 -mt-1 px-2 py-1 text-sm text-tactical-muted hover:text-tactical-text"
          aria-label="Close object details"
        >
          x
        </button>
      </div>

      <div className="mt-3">
        <DataRow k="Size" v={`${selected.extent.map((x) => x.toFixed(1)).join(' x ')} m`} />
        <DataRow k="Thermal" v={`${selected.avg_temperature.toFixed(1)} C`} accent={selected.avg_temperature >= 20 ? 'warning' : undefined} />
        <DataRow k="Easting" v={selected.center[0].toFixed(1)} />
        <DataRow k="Northing" v={selected.center[1].toFixed(1)} />
        <DataRow k="Elevation" v={`${selected.center[2].toFixed(1)} m`} />
      </div>
    </div>
  )
}

const ACCENT = {
  warning: 'text-tactical-warning',
} as const

function DataRow({ k, v, accent }: { k: string; v: string; accent?: keyof typeof ACCENT }) {
  const color = accent ? ACCENT[accent] : 'text-tactical-text'
  return (
    <div className="data-row">
      <span className="text-tactical-muted">{k}</span>
      <span className={`${color} text-right`}>{v}</span>
    </div>
  )
}
