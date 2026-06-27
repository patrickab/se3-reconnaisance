import { create } from 'zustand'
import { BoundingBox, BoxClass, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, Layers, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, ViewshedInfo } from './types'

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
  overlayOnRgb: boolean
  layers: Layers
  classVisibility: ClassVisibility
  selected: BoundingBox | null
  selectedCursor: SceneCursor | null
  selectedThreat: ThreatPosition | null
  selectedThreatPoint: ScreenPoint | null
  placing: boolean
  friendly: [number, number][]
  scanning: boolean

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null; threatInfo: ThreatInfo | null; fieldsInfo: FieldsInfo | null }) => void
  setReady: (r: { viewshedReady: boolean; threatReady: boolean; fieldsReady: boolean }) => void
  setViewshed: (viewshedInfo: ViewshedInfo) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  setOverlayOnRgb: (overlayOnRgb: boolean) => void
  toggleLayer: (key: LayerKey) => void
  toggleClass: (key: BoxClass) => void
  select: (selected: BoundingBox | null, selectedCursor?: SceneCursor | null) => void
  selectThreat: (selectedThreat: ThreatPosition | null, selectedThreatPoint?: ScreenPoint | null) => void
  setSelectedCursorScreen: (screen: ScreenPoint) => void
  setPlacing: (placing: boolean) => void
  addFriendly: (e: number, n: number) => void
  clearFriendly: () => void
  setScanning: (scanning: boolean) => void
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
  overlayOnRgb: false,
  layers: { points: true, boxes: true, observer: true, threats: true },
  classVisibility: DEFAULT_CLASS_VISIBILITY,
  selected: null,
  selectedCursor: null,
  selectedThreat: null,
  selectedThreatPoint: null,
  placing: false,
  friendly: [],
  scanning: false,

  setData: (d) => set({ ...d, loading: false, error: null }),
  setReady: ({ viewshedReady, threatReady, fieldsReady }) => set({ viewshedReady, threatReady, fieldsReady }),
  setViewshed: (viewshedInfo) => set({ viewshedInfo, viewshedReady: true }),
  setError: (error) => set({ error, loading: false }),
  setColorMode: (colorMode) => set({ colorMode }),
  setOverlayOnRgb: (overlayOnRgb) => set({ overlayOnRgb }),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  toggleClass: (key) => set((s) => ({ classVisibility: { ...s.classVisibility, [key]: !s.classVisibility[key] } })),
  select: (selected, selectedCursor = null) => set({ selected, selectedCursor, selectedThreat: null }),
  selectThreat: (selectedThreat, selectedThreatPoint = null) => set({ selectedThreat, selectedThreatPoint, selected: null, selectedCursor: null }),
  setSelectedCursorScreen: (screen) => set((s) => (
    s.selectedCursor ? { selectedCursor: { ...s.selectedCursor, screen } } : {}
  )),
  setPlacing: (placing) => set({ placing }),
  addFriendly: (e, n) => set((s) => ({ friendly: [...s.friendly, [e, n]] })),
  clearFriendly: () => set({ friendly: [] }),
  setScanning: (scanning) => set({ scanning }),
}))
