import { postRecompute, postReset } from '../lib/api'
import { useStore } from '../lib/store'
import { UnitType } from '../lib/types'

export default function FriendlyPanel() {
  const placing = useStore((s) => s.placing)
  const removing = useStore((s) => s.removing)
  const activeSide = useStore((s) => s.activeSide)
  const activeUnitType = useStore((s) => s.activeUnitType)
  const units = useStore((s) => s.units)
  const profiles = useStore((s) => s.unitProfiles)
  const scanning = useStore((s) => s.scanning)
  const hasLaydown = useStore((s) => s.threatInfo !== null) // an analysed laydown is on the map
  const setPlacing = useStore((s) => s.setPlacing)
  const setRemoving = useStore((s) => s.setRemoving)
  const setActiveSide = useStore((s) => s.setActiveSide)
  const setActiveUnitType = useStore((s) => s.setActiveUnitType)
  const setScanning = useStore((s) => s.setScanning)

  // Doctrinal unit choices come from /api/unit-profiles (backend UNIT_CATALOG).
  // The same catalog drives both sides — adding a new unit type later needs no
  // frontend change.
  const catalog = profiles.length
    ? profiles
    : [{ unit_type: 'sniper' as UnitType, label: 'Sniper/OP' }]

  const isHostile = activeSide === 'hostile'
  const sidePlacing: 'enemy' | 'friendly' = isHostile ? 'enemy' : 'friendly'
  const sideUnits = units.filter((u) => u.side === activeSide)
  const hostile = units.filter((u) => u.side === 'hostile')

  // Static class strings — Tailwind's JIT cannot see interpolated names.
  const activeBtn = isHostile
    ? 'border-tactical-danger text-tactical-danger'
    : 'border-[#3b82f6] text-[#5b9dff]'
  const idleBtn = 'border-tactical-border text-tactical-secondary hover:text-tactical-text'

  const analyze = async () => {
    setScanning(true)
    try {
      await postRecompute()
      window.location.reload()
    } catch {
      setScanning(false)
    }
  }

  // Wipe the analysed laydown so the battlefield goes blank again.
  const reset = async () => {
    setScanning(true)
    try {
      await postReset()
      window.location.reload()
    } catch {
      setScanning(false)
    }
  }

  // place / remove are mutually exclusive map modes
  const togglePlacing = () => { setRemoving(false); setPlacing(placing === sidePlacing ? null : sidePlacing) }
  const toggleRemoving = () => { setPlacing(null); setRemoving(!removing) }
  const selectSide = (side: 'hostile' | 'friendly') => { setRemoving(false); setPlacing(null); setActiveSide(side) }

  return (
    <div className="absolute right-4 top-4 z-10 w-60 panel px-3 py-2 font-mono">
      {/* side selector: enemy (red) | ally (blue) */}
      <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold">
        <button onClick={() => selectSide('hostile')} className={`border px-2 py-1 ${isHostile ? activeBtn : idleBtn}`}>ENEMY</button>
        <button onClick={() => selectSide('friendly')} className={`border px-2 py-1 ${!isHostile ? activeBtn : idleBtn}`}>ALLY</button>
      </div>

      {/* place / remove map modes — grouped right under the side selector */}
      <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
        <button onClick={togglePlacing} className={`border px-2 py-1 ${placing === sidePlacing ? activeBtn : idleBtn}`}>
          {placing === sidePlacing ? '● placing' : 'place unit'}
        </button>
        <button onClick={toggleRemoving} disabled={!units.length}
          className={`border px-2 py-1 ${removing ? activeBtn : idleBtn} disabled:opacity-30`}>
          {removing ? '● removing' : 'remove unit'}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
        {catalog.map((t) => (
          <button
            key={t.unit_type}
            onClick={() => setActiveUnitType(t.unit_type)}
            className={`border px-1 py-1 ${activeUnitType === t.unit_type ? activeBtn : idleBtn}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 text-[10px] text-tactical-muted">
        {sideUnits.length} {isHostile ? 'enemy' : 'ally'} placed
        {placing === sidePlacing && (isHostile ? ' · drag to orient' : ' · click to drop')}
        {removing && ' · click a unit to delete'}
      </div>

      <button
        onClick={analyze}
        disabled={!hostile.length || scanning}
        className="mt-2 w-full border border-tactical-danger px-2 py-1 text-[11px] text-tactical-danger hover:text-tactical-text disabled:opacity-40"
      >
        {scanning ? 'analysing… ~15 s' : '▶ analyse threat'}
      </button>
      {hasLaydown && (
        <button
          onClick={reset}
          disabled={scanning}
          className="mt-1.5 w-full border border-tactical-border px-2 py-1 text-[11px] text-tactical-secondary hover:text-tactical-text disabled:opacity-40"
        >
          ✕ clear battlefield
        </button>
      )}
      <div className="mt-1.5 text-[9px] leading-snug text-tactical-muted">
        mark the enemy from your intel, then analyse — fields of fire, kill zones and danger are projected.
      </div>
    </div>
  )
}
