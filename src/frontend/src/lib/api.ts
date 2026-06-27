import { CloudMeta, BoundingBox, ViewshedInfo, ThreatInfo, FieldsInfo } from './types'

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
