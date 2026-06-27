import { ScreenPoint } from '../lib/types'

interface Props {
  screen: ScreenPoint | null
  width?: number
  header: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

/**
 * Shared layout shell for all information popups anchored to a scene object.
 * Position is driven by `screen` — a projected world coordinate that updates
 * as the camera moves, keeping the popup spatially locked to its subject.
 * See .docs/conventions.md § Information Panel Popup for the full contract.
 */
export default function InfoPanelPopup({ screen, width = 280, header, onClose, children }: Props) {
  if (!screen) return null
  const x = Math.max(12, Math.min(screen.x + 12, window.innerWidth - width - 12))
  const y = Math.max(12, Math.min(screen.y + 12, window.innerHeight - 220))
  return (
    <div className="absolute z-20 panel px-3 py-3" style={{ left: x, top: y, width }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{header}</div>
        <button
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center border border-tactical-border bg-tactical-panel2/60 text-xs text-tactical-muted hover:border-tactical-accent/60 hover:text-tactical-text"
          aria-label="Close"
        >✕</button>
      </div>
      {children}
    </div>
  )
}

export function DataRow({ k, v, accent }: { k: string; v: string; accent?: 'warning' | 'danger' }) {
  const color = accent === 'danger' ? 'text-tactical-danger' : accent === 'warning' ? 'text-tactical-warning' : 'text-tactical-text'
  return (
    <div className="flex items-center justify-between gap-3 border-b border-tactical-border/40 py-1.5 font-mono text-[11px] last:border-b-0">
      <span className="text-tactical-muted">{k}</span>
      <span className={`${color} text-right`}>{v}</span>
    </div>
  )
}
