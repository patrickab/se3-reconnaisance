import { useState } from 'react'
import { BrickWall, Car, Container, House, Warehouse, type LucideIcon } from 'lucide-react'
import { CLASS_COLORS } from '../lib/colors'
import { useStore } from '../lib/store'
import { BoxClass, ColorMode } from '../lib/types'

const CLASSES: { key: BoxClass; label: string }[] = [
  { key: 'shelter', label: 'Shelter' },
  { key: 'container', label: 'Container' },
  { key: 'wall', label: 'Wall' },
  { key: 'car', label: 'Car' },
]

// object-class icons (coloured by CLASS_COLORS) — clearer than a plain swatch in the demo
const CLASS_ICON: Record<BoxClass, LucideIcon> = {
  shelter: Warehouse, house: House, container: Container, wall: BrickWall, car: Car,
}

// base map appearance — always available
const BASE_MODES: { key: ColorMode; label: string }[] = [
  { key: 'rgb', label: 'RGB' },
  { key: 'height', label: 'Height' },
]

// fires/threat analysis surfaces — all need the projected fields (place troops, then Scan)
const FIRES_MODES: { key: ColorMode; label: string }[] = [
  { key: 'risk', label: 'Risk Classification' },
  { key: 'depth', label: 'Crossfire Indicator' },
  { key: 'pfatal', label: 'Probability of Lethal Fire' },
]

// "risk to" — which mover's surface to show (per-target-class risk)
const RISK_TO: { key: 'dismount' | 'light_veh' | 'armour'; label: string }[] = [
  { key: 'dismount', label: 'Infantry' },   // display label only; backend class key stays 'dismount'
  { key: 'light_veh', label: 'Light veh' },
  { key: 'armour', label: 'Armour' },
]

// risk-band legend (matches riskBand() in Viewer.ts)
const RISK_LEGEND: { sw: string; label: string }[] = [
  { sw: '#d7191c', label: 'No-go / kill zone' },
  { sw: '#f07c1e', label: 'High' },
  { sw: '#fdb827', label: 'Moderate' },
  { sw: '#5b7da0', label: 'Low · behind cover' },
  { sw: '#74908a', label: 'Low · dead ground (hidden, unverified)' },
  { sw: '#34854f', label: 'Low · out of range' },
]

export default function Hud() {
  const [collapsed, setCollapsed] = useState(false)
  const { meta, boxes, colorMode, setColorMode, layers, classVisibility, toggleClass } = useStore()
  const riskClass = useStore((s) => s.riskClass)
  const setRiskClass = useStore((s) => s.setRiskClass)
  const fieldsReady = useStore((s) => s.fieldsReady)
  if (!meta) return null

  const counts = boxes.reduce<Record<BoxClass, number>>(
    (acc, box) => ({ ...acc, [box.class_label]: acc[box.class_label] + 1 }),
    { car: 0, container: 0, wall: 0, house: 0, shelter: 0 }
  )
  const boxesVisible = layers.boxes

  return (
    <div className="absolute left-4 top-4 z-10 w-[min(15.5rem,calc(100vw-2rem))] max-sm:left-3 max-sm:top-3">
      <div className="panel px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">SE3 Recon</div>
            <div className="mt-1 font-mono text-sm font-semibold uppercase tracking-[0.14em] text-tactical-text">Tactical Surface</div>
          </div>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="grid h-7 w-7 shrink-0 place-items-center border border-tactical-border bg-tactical-panel2/50 text-center text-sm leading-none text-tactical-muted hover:border-tactical-accent/60 hover:text-tactical-text"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? '+' : '-'}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-3 space-y-3">
            <div className="border border-tactical-border/60 bg-tactical-bg/25 px-3 py-2 text-tactical-secondary">
              <Metric k="area" v={`${meta.span[0].toFixed(0)} x ${meta.span[1].toFixed(0)} m`} />
              <Metric k="points" v={meta.n.toLocaleString()} />
              <Metric k="objects" v={boxes.length.toString()} />
            </div>

            <div>
              <div className="sr-only">Base map mode</div>
              <div className="segmented-toggle grid grid-cols-2 font-mono text-[11px] text-tactical-secondary">
                {BASE_MODES.map((mode) => {
                  const active = colorMode === mode.key
                  return (
                    <button
                      key={mode.key}
                      onClick={() => setColorMode(mode.key)}
                      className={`min-w-0 truncate px-2 py-1.5 transition hover:text-tactical-text ${
                        active ? 'bg-tactical-accent/15 text-tactical-accent shadow-[inset_0_0_0_1px_rgb(208_168_92_/_0.28)]' : ''
                      }`}
                      aria-pressed={active}
                    >
                      {mode.label}
                    </button>
                  )
                })}
              </div>

              <div className="eyebrow mb-1.5 mt-3">Battlefield Analysis</div>
              <div className="space-y-1">
                {FIRES_MODES.map((mode) => {
                  const active = colorMode === mode.key
                  return (
                    <button
                      key={mode.key}
                      disabled={!fieldsReady}
                      onClick={() => fieldsReady && setColorMode(mode.key)}
                      title={!fieldsReady ? 'place your troops, then Scan' : undefined}
                      className={`w-full truncate border px-2.5 py-1.5 text-left font-mono text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? 'border-tactical-accent/40 bg-tactical-accent/15 text-tactical-accent'
                          : 'border-tactical-border/60 text-tactical-secondary hover:text-tactical-text'
                      }`}
                      aria-pressed={active}
                    >
                      {mode.label}
                    </button>
                  )
                })}
              </div>
              {['risk', 'depth', 'pfatal'].includes(colorMode) && (
                <div className="mt-2">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-tactical-muted">risk for</div>
                  <div className="segmented-toggle grid grid-cols-3 font-mono text-[11px] text-tactical-secondary">
                    {RISK_TO.map((rc) => (
                      <button key={rc.key} onClick={() => setRiskClass(rc.key)}
                        className={`min-w-0 truncate px-1 py-1.5 transition hover:text-tactical-text ${riskClass === rc.key ? 'bg-tactical-accent/15 text-tactical-accent shadow-[inset_0_0_0_1px_rgb(208_168_92_/_0.28)]' : ''}`}
                        aria-pressed={riskClass === rc.key}>{rc.label}</button>
                    ))}
                  </div>
                </div>
              )}
              {colorMode === 'risk' && (
                <div className="mt-2 border border-tactical-border/60 bg-tactical-bg/25 px-3 py-2.5 font-mono text-[11px] text-tactical-secondary">
                  {RISK_LEGEND.map((r) => (
                    <div key={r.label} className="flex items-center gap-2 py-1">
                      <span className="h-3 w-3 shrink-0 rounded-[2px] border border-black/30" style={{ backgroundColor: r.sw }} />
                      <span className="truncate">{r.label}</span>
                    </div>
                  ))}
                  <div className="mt-1.5 text-[9px] leading-snug text-tactical-muted">dead ground = hidden, not proven safe (vegetation not modelled). faded = low-confidence intel.</div>
                </div>
              )}
            </div>

            <div>
              <div className="grid grid-cols-1 gap-1">
                {CLASSES.map(({ key, label }) => {
                  const active = classVisibility[key]
                  const Icon = CLASS_ICON[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggleClass(key)}
                      className={`legend-cell flex w-full items-center justify-between gap-2 px-2.5 py-2 font-mono text-[12px] transition ${
                        active && boxesVisible ? 'text-tactical-text' : 'text-tactical-muted opacity-45'
                      }`}
                      aria-pressed={active}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon size={16} strokeWidth={2} className="shrink-0" style={{ color: hexColor(CLASS_COLORS[key]) }} />
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
    <div className="flex items-center justify-between gap-3 border-b border-tactical-border/30 py-1.5 font-mono text-xs last:border-b-0">
      <span className="text-[11px] text-tactical-muted">{k}</span>
      <span className="truncate text-right font-medium text-tactical-text">{v}</span>
    </div>
  )
}

function hexColor(value: number) {
  return `#${value.toString(16).padStart(6, '0')}`
}
