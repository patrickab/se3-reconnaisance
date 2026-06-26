export interface CloudMeta {
  n: number
  origin: [number, number, number]
  span: [number, number, number]
}

export interface BoundingBox {
  id: string
  name: string
  class_label: 'car' | 'container' | 'wall' | 'house' | 'shelter'
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

export type ColorMode = 'rgb' | 'height' | 'viewshed'
export type LayerKey = 'points' | 'boxes' | 'observer'
export type Layers = Record<LayerKey, boolean>
