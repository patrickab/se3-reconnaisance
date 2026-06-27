export type BoxClass = 'car' | 'container' | 'wall' | 'house' | 'shelter'

export interface CloudMeta {
  n: number
  origin: [number, number, number]
  span: [number, number, number]
}

export type WorldCoordinate = [number, number, number]

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

// ---- unified unit contact model (mirrors src/backend/units.py) ---------------

export type UnitSide        = 'friendly' | 'hostile' | 'unknown'
export type UnitWeightClass = 'heavy' | 'medium' | 'light'
export type UnitType        = 'tank' | 'ifv' | 'apc' | 'assault' | 'sniper' | 'mortar' | 'at_team' | 'atgm_team'
export type UnitFireKind    = 'direct' | 'indirect' | 'observer'
export type UnitSource      = 'visual' | 'thermal' | 'reported' | 'sigint' | 'templated'

/**
 * Doctrinal type definition (no placement/intel fields). Mirror of the backend's
 * `Unit.to_profile()` served at `GET /api/unit-profiles`. This is the frontend's
 * ONLY source of per-type range/arc/label — the drag-preview rings and popups
 * read from here, never from a hand-maintained duplicate.
 */
export interface UnitProfile {
  unit_type:    UnitType
  label:        string
  weight_class: UnitWeightClass
  role:         ThreatRole
  fire_kind:    UnitFireKind
  obs_arc:      number            // sector of observation, degrees
  eff_range_m:  number           // effective observation / engagement range, m
  max_range_m:  number           // maximum effective range, m
  height_agl_m: number           // sensor/eye height above local terrain
}

export interface UnitContact {
  id:                string
  side:              UnitSide
  weight_class:      UnitWeightClass
  unit_type:         UnitType
  label:             string
  role:              ThreatRole
  fire_kind:         UnitFireKind
  world:             [number, number, number]   // UTM (E, N, elevation_m)
  confidence:        number
  sec_since_contact: number
  source:            UnitSource
  azimuth:           number | null
  obs_arc:           number
  eff_range_m:       number
  max_range_m:       number
  height_agl_m:      number
  velocity:          [number, number] | null
}

export interface PlaceUnitRequest {
  side:       UnitSide
  unit_type:  UnitType
  world:      [number, number, number]
  azimuth:    number | null
  velocity:   [number, number] | null
  confidence?: number
  source?:    UnitSource
}

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
  avenue_source: string
  avenue: [number, number, number][]
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

export type ColorMode = 'rgb' | 'height' | 'temperature' | 'viewshed' | 'threat' | 'danger' | 'depth' | 'risk'
export type LayerKey = 'points' | 'boxes' | 'observer' | 'threats' | 'viewcones'
export type Layers = Record<LayerKey, boolean>
export type ClassVisibility = Record<BoxClass, boolean>
export interface ScreenPoint {
  x: number
  y: number
}
export interface SceneCursor {
  screen: ScreenPoint
  world: WorldCoordinate
}

export interface ViewshedResult {
  flags: Uint8Array
  info: ViewshedInfo
}
