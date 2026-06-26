import { useStore } from '../lib/store'
import { ColorMode, LayerKey } from '../lib/types'

const MODES: { key: ColorMode; label: string }[] = [
  { key: 'rgb', label: 'RGB' },
  { key: 'height', label: 'Elevation' },
  { key: 'viewshed', label: 'Viewshed' },
]

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'points', label: 'Point cloud' },
  { key: 'boxes', label: 'Objects' },
  { key: 'observer', label: 'Observer' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-tactical-border">
      <h2 className="text-[10px] font-semibold tracking-[0.15em] text-tactical-secondary uppercase mb-2">{title}</h2>
      {children}
    </div>
  )
}

export default function Sidebar() {
  const { colorMode, setColorMode, layers, toggleLayer, selected, viewshedReady, viewshedInfo } = useStore()

  return (
    <aside className="w-72 shrink-0 bg-black/40 backdrop-blur border-l border-tactical-border flex flex-col font-mono text-tactical-text">
      <Section title="Colour mode">
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => {
            const disabled = m.key === 'viewshed' && !viewshedReady
            const active = colorMode === m.key
            return (
              <button
                key={m.key}
                disabled={disabled}
                onClick={() => setColorMode(m.key)}
                className={`px-2 py-1.5 text-xs rounded border transition
                  ${active ? 'bg-tactical-accent/20 border-tactical-accent text-tactical-accent' : 'border-tactical-border hover:border-tactical-secondary'}
                  ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Layers">
        <div className="space-y-1.5">
          {LAYERS.map((l) => (
            <label key={l.key} className="flex items-center gap-2 text-xs cursor-pointer text-tactical-secondary hover:text-tactical-text">
              <input type="checkbox" checked={layers[l.key]} onChange={() => toggleLayer(l.key)} className="accent-tactical-accent" />
              {l.label}
            </label>
          ))}
        </div>
      </Section>

      <div className="flex-1 overflow-auto">
        {selected ? (
          <Section title="Selected object">
            <div className="text-xs space-y-1">
              <Row k="Name" v={selected.name} />
              <Row k="Class" v={selected.class_label} />
              <Row k="Size" v={selected.extent.map((x) => x.toFixed(1)).join(' × ') + ' m'} />
              <Row k="Temp" v={`${selected.avg_temperature.toFixed(1)} °C`} accent="danger" />
              <Row k="Easting" v={selected.center[0].toFixed(1)} />
              <Row k="Northing" v={selected.center[1].toFixed(1)} />
            </div>
          </Section>
        ) : viewshedInfo && colorMode === 'viewshed' ? (
          <Section title="Viewshed · enemy OP">
            <div className="text-xs space-y-1">
              <Row k="OP" v={viewshedInfo.observer_label} accent="warning" />
              <Row k="Eye height" v={`${viewshedInfo.observer_world[2].toFixed(0)} m`} />
              <Row k="Range" v={`${viewshedInfo.params.range_m.toFixed(0)} m`} />
              <Row k="Arc" v={`${viewshedInfo.params.arc_deg.toFixed(0)}°`} />
              <Row k="Seen" v={`${viewshedInfo.pct_points_visible}%`} accent="danger" />
              <Row k="Dead ground" v={`${(100 - viewshedInfo.pct_points_visible).toFixed(1)}%`} accent="success" />
            </div>
          </Section>
        ) : (
          <div className="px-4 py-6 text-xs text-tactical-secondary/60">Click an object to inspect.</div>
        )}
      </div>
    </aside>
  )
}

const ACCENT = {
  danger: 'text-tactical-danger',
  success: 'text-tactical-success',
  warning: 'text-tactical-warning',
} as const

function Row({ k, v, accent }: { k: string; v: string; accent?: keyof typeof ACCENT }) {
  const color = accent ? ACCENT[accent] : 'text-tactical-text'
  return (
    <div className="flex justify-between gap-3">
      <span className="text-tactical-secondary">{k}</span>
      <span className={color}>{v}</span>
    </div>
  )
}
