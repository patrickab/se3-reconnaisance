import { create } from 'zustand'
import { BoundingBox, BoxClass, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, Layers, ScreenPoint, ThreatInfo, ThreatPosition, ViewshedInfo } from './types'

interface AppState {
  meta: CloudMeta | null
  boxes: BoundingBox[]
  viewshedInfo: ViewshedInfo | null
  viewshedReady: boolean
  threatInfo: ThreatInfo | null
  threatReady: boolean
  fieldsInfo: FieldsInfo | null
  fieldsReady: boolean
  loading: boolean
  error: string | null

  colorMode: ColorMode
  layers: Layers
  classVisibility: ClassVisibility
  selected: BoundingBox | null
  selectedPoint: ScreenPoint | null
  selectedThreat: ThreatPosition | null
  selectedThreatPoint: ScreenPoint | null

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null; threatInfo: ThreatInfo | null; fieldsInfo: FieldsInfo | null }) => void
  setReady: (r: { viewshedReady: boolean; threatReady: boolean; fieldsReady: boolean }) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  toggleLayer: (key: LayerKey) => void
  toggleClass: (key: BoxClass) => void
  select: (selected: BoundingBox | null, selectedPoint?: ScreenPoint | null) => void
  selectThreat: (selectedThreat: ThreatPosition | null, selectedThreatPoint?: ScreenPoint | null) => void
}

const DEFAULT_CLASS_VISIBILITY: ClassVisibility = {
  car: true,
  container: true,
  wall: true,
  house: true,
  shelter: true,
}

export const useStore = create<AppState>((set) => ({
  meta: null,
  boxes: [],
  viewshedInfo: null,
  viewshedReady: false,
  threatInfo: null,
  threatReady: false,
  fieldsInfo: null,
  fieldsReady: false,
  loading: true,
  error: null,

  colorMode: 'rgb',
  layers: { points: true, boxes: true, observer: true, threats: true },
  classVisibility: DEFAULT_CLASS_VISIBILITY,
  selected: null,
  selectedPoint: null,
  selectedThreat: null,
  selectedThreatPoint: null,

  setData: (d) => set({ ...d, loading: false, error: null }),
  setReady: ({ viewshedReady, threatReady, fieldsReady }) => set({ viewshedReady, threatReady, fieldsReady }),
  setError: (error) => set({ error, loading: false }),
  setColorMode: (colorMode) => set({ colorMode }),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  toggleClass: (key) => set((s) => ({ classVisibility: { ...s.classVisibility, [key]: !s.classVisibility[key] } })),
  select: (selected, selectedPoint = null) => set({ selected, selectedPoint, selectedThreat: null }),
  selectThreat: (selectedThreat, selectedThreatPoint = null) => set({ selectedThreat, selectedThreatPoint, selected: null }),
}))
