import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { ColorMode, LayerKey } from '../lib/types'

const MODES: { key: ColorMode; label: string }[] = [
  { key: 'rgb', label: 'RGB' },
  { key: 'height', label: 'Height' },
]

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'points', label: 'Cloud' },
  { key: 'boxes', label: 'Objects' },
]

export default function Sidebar() {
  const { colorMode, setColorMode, layers, toggleLayer } = useStore()

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-tactical-border bg-tactical-panel/95 text-tactical-text max-md:absolute max-md:bottom-0 max-md:right-0 max-md:h-[42dvh] max-md:w-full max-md:border-l-0 max-md:border-t">
      <header className="border-b border-tactical-border px-4 py-4">
        <div>
          <div className="text-sm font-semibold">Scene controls</div>
          <div className="mt-1 text-xs text-tactical-muted">Display and inspection</div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        <Section title="Mode">
          <div className="space-y-2">
            {MODES.map((mode) => {
              const active = colorMode === mode.key
              return (
                <label
                  key={mode.key}
                  className={`flex cursor-pointer items-center justify-between gap-3 text-sm ${active ? 'text-tactical-text' : 'text-tactical-secondary hover:text-tactical-text'}`}
                >
                  <span>{mode.label}</span>
                  <input
                    type="radio"
                    name="color-mode"
                    checked={active}
                    onChange={() => setColorMode(mode.key)}
                    className="h-4 w-4 accent-tactical-accent"
                  />
                </label>
              )
            })}
          </div>
        </Section>

        <Section title="Layers">
          <div className="space-y-2">
            {LAYERS.map((layer) => (
              <label key={layer.key} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-tactical-secondary hover:text-tactical-text">
                <span>{layer.label}</span>
                <input type="checkbox" checked={layers[layer.key]} onChange={() => toggleLayer(layer.key)} className="h-4 w-4 accent-tactical-accent" />
              </label>
            ))}
          </div>
        </Section>

      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-tactical-muted">{title}</h2>
      {children}
    </section>
  )
}
