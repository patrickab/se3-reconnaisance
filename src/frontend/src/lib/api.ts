import { CloudMeta, BoundingBox, ViewshedInfo, ThreatInfo, FieldsInfo, WorldCoordinate, ViewshedResult, UnitContact, PlaceUnitRequest, UnitProfile } from './types'

// Relative URLs: dev goes through the Vite proxy (vite.config.ts), prod is
// served same-origin. Required GETs throw; optional ones resolve to null.
const json = <T>(p: string): Promise<T> =>
  fetch(p).then((r) => {
    if (!r.ok) throw new Error(`GET ${p} → ${r.status}`)
    return r.json()
  })

const optional = async <T>(p: string): Promise<T | null> => {
  const r = await fetch(p)
  return r.ok ? r.json() : null
}

export const fetchMeta = () => json<CloudMeta>('/api/meta')
export const fetchBoxes = () => json<BoundingBox[]>('/api/boxes')
export const fetchViewshedInfo = () => optional<ViewshedInfo>('/api/viewshed-info')

export const fetchCloud = async (): Promise<ArrayBuffer> => {
  const r = await fetch('/api/cloud')
  if (!r.ok) throw new Error(`GET /api/cloud → ${r.status}`)
  return r.arrayBuffer()
}

export const fetchViewshed = async (): Promise<Uint8Array | null> => {
  const r = await fetch('/api/viewshed')
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
}

export const fetchThreatInfo = () => optional<ThreatInfo>('/api/threat-info')

export const fetchThreat = async (): Promise<Uint8Array | null> => {
  const r = await fetch('/api/threat')
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
}

export const fetchFieldsInfo = () => optional<FieldsInfo>('/api/fields-info')

const bin = async (p: string): Promise<Uint8Array | null> => {
  const r = await fetch(p)
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
}
export const fetchDanger = () => bin('/api/danger')
export const fetchDepth = () => bin('/api/depth')

export const fetchViewshedAt = async (world: WorldCoordinate): Promise<ViewshedResult> => {
  const r = await fetch('/api/viewshed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ x: world[0], y: world[1], z: world[2] }),
  })
  if (!r.ok) throw new Error(`POST /api/viewshed → ${r.status}`)
  const info = r.headers.get('x-viewshed-info')
  if (!info) throw new Error('POST /api/viewshed missing x-viewshed-info')
  return { flags: new Uint8Array(await r.arrayBuffer()), info: JSON.parse(info) as ViewshedInfo }
}

// Build the enemy laydown from operator-placed positions + project the fields. Heavy (~15 s).
// Omit body to use the backend's /api/units store as the source.
export const postRecompute = (): Promise<{ ok: boolean; n_enemies: number; n_friendly: number }> =>
  fetch('/api/threat/recompute', { method: 'POST' }).then((r) => {
    if (!r.ok) throw new Error(`recompute → ${r.status}`)
    return r.json()
  })

// Wipe the analysed laydown (enemy markers + projected fields) — back to a blank battlefield.
export const postReset = (): Promise<{ ok: boolean }> =>
  fetch('/api/threat/reset', { method: 'POST' }).then((r) => {
    if (!r.ok) throw new Error(`reset → ${r.status}`)
    return r.json()
  })

export const fetchUnits = (): Promise<UnitContact[]> => json<UnitContact[]>('/api/units')

export const fetchUnitProfiles = (): Promise<UnitProfile[]> => json<UnitProfile[]>('/api/unit-profiles')

export const postUnit = (req: PlaceUnitRequest): Promise<UnitContact> =>
  fetch('/api/units', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }).then((r) => {
    if (!r.ok) throw new Error(`POST /api/units → ${r.status}`)
    return r.json()
  })

export const deleteUnit = (id: string): Promise<void> =>
  fetch(`/api/units/${id}`, { method: 'DELETE' }).then(() => undefined)

export const clearUnits = (side?: 'hostile' | 'friendly'): Promise<void> =>
  fetch(side ? `/api/units?side=${side}` : '/api/units', { method: 'DELETE' }).then(() => undefined)
