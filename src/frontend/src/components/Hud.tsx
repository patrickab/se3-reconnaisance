import { useState } from 'react'
import { CLASS_COLORS } from '../lib/colors'
import { useStore } from '../lib/store'
import { BoxClass, ColorMode } from '../lib/types'

const CLASSES: { key: BoxClass; label: string }[] = [
  { key: 'shelter', label: 'Shelter' },
  { key: 'house', label: 'House' },
  { key: 'container', label: 'Container' },
  { key: 'wall', label: 'Wall' },
  { key: 'car', label: 'Car' },
]

const MODES: { key: ColorMode; label: string; needs?: 'viewshed' | 'threat' | 'fields' }[] = [
  { key: 'rgb', label: 'RGB' },
  { key: 'height', label: 'Height' },
  { key: 'temperature', label: 'Temp.' },
  { key: 'viewshed', label: 'LOS', needs: 'viewshed' },
  { key: 'threat', label: 'Threat', needs: 'threat' },
  { key: 'danger', label: 'Danger', needs: 'fields' },
  { key: 'depth', label: 'Kill zone', needs: 'fields' },
]

export default function Hud() {
  const [collapsed, setCollapsed] = useState(false)
  const { meta, boxes, colorMode, setColorMode, layers, toggleLayer, classVisibility, toggleClass, viewshedInfo } = useStore()
  const overlayOnRgb = useStore((s) => s.overlayOnRgb)
  const setOverlayOnRgb = useStore((s) => s.setOverlayOnRgb)
  const viewshedReady = useStore((s) => s.viewshedReady)
  const threatReady = useStore((s) => s.threatReady)
  const fieldsReady = useStore((s) => s.fieldsReady)
  if (!meta) return null

  const counts = boxes.reduce<Record<BoxClass, number>>(
    (acc, box) => ({ ...acc, [box.class_label]: acc[box.class_label] + 1 }),
    { car: 0, container: 0, wall: 0, house: 0, shelter: 0 }
  )
  const boxesVisible = layers.boxes

  return (
    <div className="absolute left-4 top-4 z-10 w-[min(18rem,calc(100vw-2rem))] max-sm:left-3 max-sm:top-3">
      <div className="panel px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">SE3 Recon</div>
            <div className="mt-1 text-2xl font-semibold leading-none tracking-[-0.05em] text-tactical-text">Tactical surface</div>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-tactical-muted">
              <span className="soft-tag border-tactical-success/40 text-tactical-success">cloud online</span>
              <span className={`soft-tag ${viewshedReady ? 'border-tactical-success/40 text-tactical-success' : 'border-tactical-warning/40 text-tactical-warning'}`}>
                {viewshedReady ? 'viewshed ready' : 'viewshed absent'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-tactical-border/90 bg-tactical-panel2/70 text-center text-lg leading-none text-tactical-muted hover:border-tactical-accent/60 hover:text-tactical-text"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? '+' : '-'}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-4 border-t border-tactical-border/70 pt-4">
            <div className="grid grid-cols-2 gap-2 text-tactical-secondary">
              <Metric k="area" v={`${meta.span[0].toFixed(0)} x ${meta.span[1].toFixed(0)} m`} />
              <Metric k="points" v={meta.n.toLocaleString()} />
              <Metric k="objects" v={boxes.length.toString()} />
              <Metric k="relief" v={`${meta.span[2].toFixed(1)} m`} />
            </div>
            {viewshedInfo && (
              <div className="mt-3 rounded-xl border border-tactical-border/70 bg-tactical-bg/40 px-3 py-2 font-mono text-[11px] text-tactical-secondary">
                <div className="flex justify-between gap-3">
                  <span className="text-tactical-muted">observer</span>
                  <span className="truncate text-right text-tactical-text">{viewshedInfo.observer_label}</span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span className="text-tactical-muted">seen points</span>
                  <span className="text-tactical-warning">{viewshedInfo.pct_points_visible.toFixed(1)}%</span>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-tactical-border/60 pt-4">
              <div className="sr-only">Display mode</div>
              <div className="segmented-toggle grid grid-cols-4 font-mono text-[10px] text-tactical-secondary">
              {MODES.map((mode) => {
                const active = colorMode === mode.key
                const ready = mode.needs === 'viewshed' ? viewshedReady
                  : mode.needs === 'threat' ? threatReady
                  : mode.needs === 'fields' ? fieldsReady
                  : true
                const script = mode.needs === 'threat' ? 'threat_template.py' : mode.needs === 'fields' ? 'fields.py' : 'visibility.py'
                return (
                  <button
                    key={mode.key}
                    disabled={!ready}
                    onClick={() => ready && setColorMode(mode.key)}
                    title={!ready ? `run ${script}` : undefined}
                    className={`min-w-0 truncate px-2 py-1.5 transition hover:text-tactical-text disabled:cursor-not-allowed disabled:opacity-40 ${
                      active ? 'bg-tactical-accent/15 text-tactical-accent shadow-[inset_0_0_0_1px_rgb(208_168_92_/_0.28)]'
                        : mode.key === 'threat' ? 'text-tactical-danger'
                        : mode.key === 'temperature' ? 'text-tactical-warning'
                        : ''
                    }`}
                    aria-pressed={active}
                  >
                    {mode.label}
                  </button>
                )
              })}
              </div>
              <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-2 text-[10px] text-tactical-secondary hover:text-tactical-text">
                <span>over RGB map</span>
                <input
                  type="checkbox"
                  checked={overlayOnRgb}
                  onChange={(e) => setOverlayOnRgb(e.target.checked)}
                  className="h-3 w-3 accent-tactical-accent"
                />
              </label>
            </div>

            <div className="mt-4 border-t border-tactical-border/60 pt-4">
              <button
                onClick={() => toggleLayer('boxes')}
                className="tactical-button w-full text-tactical-secondary"
                aria-pressed={boxesVisible}
              >
                {boxesVisible ? 'Hide object boxes' : 'Show object boxes'}
              </button>
              {threatReady && (
                <button
                  onClick={() => toggleLayer('threats')}
                  className="mt-1 w-full border border-tactical-danger/60 px-2 py-1 text-left text-[10px] text-tactical-danger hover:text-tactical-text"
                >
                  {layers.threats ? 'hide enemy markers' : 'show enemy markers'}
                </button>
              )}

              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {CLASSES.map(({ key, label }) => {
                  const active = classVisibility[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggleClass(key)}
                      className={`legend-cell flex w-full items-center justify-between gap-2 px-2.5 py-2 font-mono text-[11px] transition ${
                        active && boxesVisible ? 'text-tactical-text' : 'text-tactical-muted opacity-45'
                      }`}
                      aria-pressed={active}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-black/30" style={{ backgroundColor: hexColor(CLASS_COLORS[key]) }} />
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="text-tactical-muted">{counts[key]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-tactical-border/60 bg-tactical-bg/30 px-3 py-2 font-mono">
      <div className="text-[10px] text-tactical-muted">{k}</div>
      <div className="mt-1 truncate text-xs font-medium text-tactical-text">{v}</div>
    </div>
  )
}

function hexColor(value: number) {
  return `#${value.toString(16).padStart(6, '0')}`
}
