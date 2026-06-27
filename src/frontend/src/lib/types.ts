export type BoxClass = 'car' | 'container' | 'wall' | 'house' | 'shelter'

export interface CloudMeta {
  n: number
  origin: [number, number, number]
  span: [number, number, number]
}

export interface BoundingBox {
  id: string
  name: string
  class_label: BoxClass
  center: [number, number, number]
  extent: [number, number, number]
  rotation: [number, number, number, number]
  avg_temperature: number
}

export interface ViewshedInfo {
  observer_label: string
  observer_world: [number, number, number]
  params: {
    range_m: number
    arc_deg: number
    facing_deg: number
    eye_h: number
    target_h: number
    res_m: number
  }
  pct_points_visible: number
  cells_visible: number
}

export type ThreatRole = 'observer' | 'anti_armor' | 'indirect'
export type ThreatType = 'sniper_op' | 'tank' | 'mortar'

export interface ThreatPosition {
  id: string
  role: ThreatRole
  type: ThreatType
  world: [number, number, number]
  facing_deg: number
  arc_deg: number
  score: number
  sees_pct_of_approach: number
  cover_dist_m: number
  height_above_ground_m: number
  thermal_cue: number
  defilade_m: number
}

export interface ThreatInfo {
  side: string
  aa_points: number
  range_m: number
  avenue: [number, number][]
  avenue_centroid: [number, number]
  positions: ThreatPosition[]
}

export interface FieldsInfo {
  side: string
  n_direct_shooters: number
  max_engagement_depth: number
  trps: [number, number][]
  pct_in_kill_zone: number
  note: string
}

export type ColorMode = 'rgb' | 'height' | 'temperature' | 'viewshed' | 'threat' | 'danger' | 'depth'
export type LayerKey = 'points' | 'boxes' | 'observer' | 'threats'
export type Layers = Record<LayerKey, boolean>
export type ClassVisibility = Record<BoxClass, boolean>
export interface ScreenPoint {
  x: number
  y: number
}
