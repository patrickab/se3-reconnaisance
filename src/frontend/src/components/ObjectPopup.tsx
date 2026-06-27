import { useStore } from '../lib/store'

export default function ObjectPopup() {
  const selected = useStore((s) => s.selected)
  const selectedCursor = useStore((s) => s.selectedCursor)
  const select = useStore((s) => s.select)
  if (!selected) return null

  const width = 260
  const x = selectedCursor ? Math.min(selectedCursor.screen.x + 10, window.innerWidth - width - 12) : 16
  const y = selectedCursor ? Math.min(selectedCursor.screen.y + 10, window.innerHeight - 190) : window.innerHeight - 230

  return (
    <div className="absolute z-20 panel px-3 py-3" style={{ left: Math.max(12, x), top: Math.max(12, y), width }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">selected object</div>
          <div className="mt-1 font-mono text-sm font-semibold uppercase tracking-[0.08em] text-tactical-text">{selected.name}</div>
          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-tactical-muted">{selected.class_label}</div>
        </div>
        <button
          onClick={() => select(null)}
          className="-mr-1 -mt-1 grid h-7 w-7 place-items-center border border-tactical-border bg-tactical-panel2/60 text-xs text-tactical-muted hover:border-tactical-accent/60 hover:text-tactical-text"
          aria-label="Close object details"
        >
          x
        </button>
      </div>

      <div className="mt-3 border border-tactical-border/50 bg-tactical-bg/30 px-2.5">
        <DataRow k="Size" v={`${selected.extent.map((x) => x.toFixed(1)).join(' x ')} m`} />
        <DataRow k="Thermal" v={`${selected.avg_temperature.toFixed(1)} deg C`} accent={selected.avg_temperature >= 20 ? 'warning' : undefined} />
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
    <div className="flex items-center justify-between gap-3 border-b border-tactical-border/40 py-1.5 font-mono text-[11px] last:border-b-0">
      <span className="text-tactical-muted">{k}</span>
      <span className={`${color} text-right`}>{v}</span>
    </div>
  )
}
