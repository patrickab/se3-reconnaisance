import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { RiskZone, SoldierExposure } from '../lib/types'

// red alert   = kill zone (no-go)
// orange warn = high risk
// attention   = moderate (yellow)
type Tier = 'red' | 'orange' | 'yellow'

const ZONE_TO_TIER: Record<RiskZone, Tier | null> = {
  kill_zone: 'red',
  high: 'orange',
  moderate: 'yellow',
  low: null,
}

const TONE: Record<Tier, { text: string; border: string; bg: string; head: string; desc: string }> = {
  red:    { text: 'text-tactical-danger',  border: 'border-tactical-danger',  bg: 'bg-tactical-panel',  head: 'Alert',     desc: 'acute danger' },
  orange: { text: 'text-tactical-caution', border: 'border-tactical-caution', bg: 'bg-tactical-panel', head: 'Warning',   desc: 'moderate danger' },
  yellow: { text: 'text-tactical-warning', border: 'border-tactical-warning', bg: 'bg-tactical-panel', head: 'Attention', desc: 'danger' },
}

interface Row { exposure: SoldierExposure; label: string }

interface BannerProps {
  tier: Tier
  rows: Row[]
  open: boolean
  onToggle: () => void
}

function Banner({ tier, rows, open, onToggle }: BannerProps) {
  const focusWorld = useStore((s) => s.focusWorld)
  const tone = TONE[tier]
  const n = rows.length
  return (
    <div className="flex w-full flex-col items-center">
      <div className={`flex items-center gap-1 border ${tone.border} ${tone.bg} bg-tactical-panel px-4 py-2 font-mono text-sm ${tone.text}`}>
        <span className="font-semibold uppercase tracking-[0.1em]">{tone.head}: {n}&nbsp;</span>
        <button
          onClick={onToggle}
          className="font-semibold uppercase tracking-[0.1em] underline decoration-1 underline-offset-2 opacity-90 hover:opacity-100"
          aria-expanded={open}
        >
          unit{n !== 1 ? 's' : ''}
        </button>
        <span className="font-semibold uppercase tracking-[0.1em]">&nbsp;in {tone.desc}</span>
      </div>
      {open && (
        <div className={`w-full border-x ${tone.border} border-b ${tone.border} bg-tactical-panel`}>
          {rows.map(({ exposure, label }, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-1.5 font-mono text-xs ${tone.text} border-b border-tactical-border/30 last:border-b-0`}>
              <span className="flex-1 uppercase tracking-wide">{label}</span>
              <span className="opacity-60">{tone.head}</span>
              <button
                onClick={() => focusWorld?.(exposure.world)}
                title="Locate"
                className="opacity-60 hover:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="3" />
                  <line x1="7" y1="1" x2="7" y2="4" />
                  <line x1="7" y1="10" x2="7" y2="13" />
                  <line x1="1" y1="7" x2="4" y2="7" />
                  <line x1="10" y1="7" x2="13" y2="7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DangerAlert() {
  const fields = useStore((s) => s.fieldsInfo)
  const units = useStore((s) => s.units)

  const [openTier, setOpenTier] = useState<Tier | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on Escape, outside click, or focus loss. Locating a unit does NOT close.
  useEffect(() => {
    if (!openTier) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenTier(null) }
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenTier(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [openTier])

  const soldiers: SoldierExposure[] = fields?.soldiers ?? []
  const friendly = units.filter((u) => u.side === 'friendly')

  const labelled = soldiers.map((s) => ({
    exposure: s,
    unit: friendly.find((u) => Math.abs(u.world[0] - s.world[0]) < 1 && Math.abs(u.world[1] - s.world[1]) < 1),
  }))

  const byTier: Record<Tier, Row[]> = { red: [], orange: [], yellow: [] }
  for (const { exposure, unit } of labelled) {
    const tier = ZONE_TO_TIER[exposure.zone]
    if (!tier) continue
    byTier[tier].push({ exposure, label: unit?.label ?? `Unit` })
  }

  const tiers: Tier[] = ['red', 'orange', 'yellow']
  const visible = tiers.filter((t) => byTier[t].length > 0)
  if (!visible.length) return null

  return (
    <div ref={containerRef} className="absolute left-1/2 top-14 z-30 -translate-x-1/2 flex flex-col items-center gap-1.5">
      {visible.map((t) => (
        <Banner
          key={t}
          tier={t}
          rows={byTier[t]}
          open={openTier === t}
          onToggle={() => setOpenTier((cur) => (cur === t ? null : t))}
        />
      ))}
    </div>
  )
}
