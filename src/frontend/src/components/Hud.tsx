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
  { key: 'viewshed', label: 'View', needs: 'viewshed' },
  { key: 'threat', label: 'Threat', needs: 'threat' },
  { key: 'danger', label: 'Danger', needs: 'fields' },
  { key: 'depth', label: 'Kill zone', needs: 'fields' },
]

export default function Hud() {
  const [collapsed, setCollapsed] = useState(false)
  const { meta, boxes, colorMode, setColorMode, layers, toggleLayer, classVisibility, toggleClass } = useStore()
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
    <div className="absolute left-4 top-4 z-10 w-[min(10rem,calc(100vw-2rem))] font-mono">
      <div className="panel px-2 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold tracking-[0.12em] text-tactical-accent">SE3 Recon</div>
            <div className="mt-0.5 text-[10px] text-tactical-muted">{boxes.length} bboxes</div>
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="h-5 w-5 border border-tactical-border text-center text-[13px] leading-[16px] text-tactical-muted hover:text-tactical-text"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? '+' : '-' }
          </button>
        </div>

        {!collapsed && (
          <div className="mt-2 border-t border-tactical-border/70 pt-2">
            <div className="space-y-0.5 text-[10px] text-tactical-secondary">
              <Metric k="area" v={`${meta.span[0].toFixed(0)} x ${meta.span[1].toFixed(0)} m`} />
              <Metric k="points" v={meta.n.toLocaleString()} />
              <Metric k="objects" v={boxes.length.toString()} />
            </div>

            <div className="mt-2 border-t border-tactical-border/60 pt-2">
              <div className="sr-only">Display mode</div>
              <div className="segmented-toggle grid grid-cols-3 text-[8px] text-tactical-secondary">
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
                    className={`min-w-0 truncate px-1.5 py-1 transition ${
                      !ready ? 'cursor-not-allowed opacity-30'
                        : active ? 'bg-tactical-panel2 text-tactical-accent'
                        : mode.key === 'threat' ? 'text-tactical-danger hover:text-tactical-text'
                        : mode.key === 'temperature' ? 'text-tactical-warning hover:text-tactical-text'
                        : 'hover:text-tactical-text'
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

            <div className="mt-2 border-t border-tactical-border/60 pt-2">
              <button
                onClick={() => toggleLayer('boxes')}
                className="w-full border border-tactical-border px-2 py-1 text-left text-[10px] text-tactical-secondary hover:text-tactical-text"
              >
                {boxesVisible ? 'disable boxes' : 'enable boxes'}
              </button>
              {threatReady && (
                <button
                  onClick={() => toggleLayer('threats')}
                  className="mt-1 w-full border border-tactical-danger/60 px-2 py-1 text-left text-[10px] text-tactical-danger hover:text-tactical-text"
                >
                  {layers.threats ? 'hide enemy markers' : 'show enemy markers'}
                </button>
              )}

              <div className="mt-1.5 space-y-1">
                {CLASSES.map(({ key, label }) => {
                  const active = classVisibility[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggleClass(key)}
                      className={`legend-cell flex w-full items-center justify-between gap-2 px-2 py-1 text-[11px] transition ${
                        active && boxesVisible ? 'text-tactical-text' : 'text-tactical-muted opacity-45'
                      }`}
                      aria-pressed={active}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 border border-black/30" style={{ backgroundColor: hexColor(CLASS_COLORS[key]) }} />
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
    <div className="flex justify-between gap-3">
      <span className="text-tactical-muted">{k}</span>
      <span className="text-tactical-secondary">{v}</span>
    </div>
  )
}

function hexColor(value: number) {
  return `#${value.toString(16).padStart(6, '0')}`
}
