import { create } from 'zustand'
import * as api from './api'
import { BoundingBox, BoxClass, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, Layers, PlaceUnitRequest, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo } from './types'

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
  riskClass: 'dismount' | 'light_veh' | 'armour'   // who's moving — the risk surface to show
  overlayOnRgb: boolean
  layers: Layers
  classVisibility: ClassVisibility
  selected: BoundingBox | null
  selectedCursor: SceneCursor | null
  selectedThreat: ThreatPosition | null
  selectedThreatPoint: ScreenPoint | null
  selectedUnitId: string | null
  placing: 'enemy' | 'friendly' | null
  removing: boolean
  activeSide: 'hostile' | 'friendly'
  activeUnitType: UnitType
  units: UnitContact[]
  unitProfiles: UnitProfile[]
  scanning: boolean

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null; threatInfo: ThreatInfo | null; fieldsInfo: FieldsInfo | null }) => void
  setReady: (r: { viewshedReady: boolean; threatReady: boolean; fieldsReady: boolean }) => void
  setViewshed: (viewshedInfo: ViewshedInfo) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  setRiskClass: (riskClass: 'dismount' | 'light_veh' | 'armour') => void
  setOverlayOnRgb: (overlayOnRgb: boolean) => void
  toggleLayer: (key: LayerKey) => void
  toggleClass: (key: BoxClass) => void
  select: (selected: BoundingBox | null, selectedCursor?: SceneCursor | null) => void
  selectThreat: (selectedThreat: ThreatPosition | null, selectedThreatPoint?: ScreenPoint | null) => void
  selectUnit: (id: string | null, cursor?: SceneCursor | null) => void
  setSelectedCursorScreen: (screen: ScreenPoint) => void
  setPlacing: (placing: 'enemy' | 'friendly' | null) => void
  setRemoving: (removing: boolean) => void
  setActiveSide: (side: 'hostile' | 'friendly') => void
  setActiveUnitType: (t: UnitType) => void
  setUnits: (units: UnitContact[]) => void
  setUnitProfiles: (profiles: UnitProfile[]) => void
  placeUnit: (req: PlaceUnitRequest) => Promise<void>
  removeUnit: (id: string) => Promise<void>
  clearUnits: (side: 'hostile' | 'friendly') => Promise<void>
  reorientUnit: (id: string, azimuth: number) => Promise<void>
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
  riskClass: 'dismount',
  overlayOnRgb: false,
  layers: { points: true, boxes: true, observer: true, threats: true, viewcones: true },
  classVisibility: DEFAULT_CLASS_VISIBILITY,
  selected: null,
  selectedCursor: null,
  selectedThreat: null,
  selectedThreatPoint: null,
  selectedUnitId: null,
  placing: null,
  removing: false,
  activeSide: 'hostile',
  activeUnitType: 'sniper',
  units: [],
  unitProfiles: [],
  scanning: false,

  setData: (d) => set({ ...d, loading: false, error: null }),
  setReady: ({ viewshedReady, threatReady, fieldsReady }) => set({ viewshedReady, threatReady, fieldsReady }),
  setViewshed: (viewshedInfo) => set({ viewshedInfo, viewshedReady: true }),
  setError: (error) => set({ error, loading: false }),
  // Kill (depth) / Danger / Risk read best painted onto the real map — default the RGB overlay
  // on when entering them; the operator can still toggle it off.
  setColorMode: (colorMode) => set((s) => ({
    colorMode,
    overlayOnRgb: colorMode === 'danger' || colorMode === 'depth' || colorMode === 'risk' ? true : s.overlayOnRgb,
  })),
  setRiskClass: (riskClass) => set({ riskClass }),
  setOverlayOnRgb: (overlayOnRgb) => set({ overlayOnRgb }),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  toggleClass: (key) => set((s) => ({ classVisibility: { ...s.classVisibility, [key]: !s.classVisibility[key] } })),
  select: (selected, selectedCursor = null) => set({ selected, selectedCursor, selectedThreat: null, selectedUnitId: null }),
  selectThreat: (selectedThreat, selectedThreatPoint = null) => set({ selectedThreat, selectedThreatPoint, selected: null, selectedCursor: null, selectedUnitId: null }),
  selectUnit: (selectedUnitId, cursor = null) => set({ selectedUnitId, selectedCursor: cursor, selected: null, selectedThreat: null }),
  setSelectedCursorScreen: (screen) => set((s) => (
    s.selectedCursor ? { selectedCursor: { ...s.selectedCursor, screen } } : {}
  )),
  setPlacing: (placing) => set({ placing }),
  setRemoving: (removing) => set({ removing }),
  setActiveSide: (activeSide) => set({ activeSide }),
  setActiveUnitType: (activeUnitType) => set({ activeUnitType }),
  setUnits: (units) => set({ units }),
  setUnitProfiles: (unitProfiles) => set({ unitProfiles }),

  placeUnit: async (req) => {
    const unit = await api.postUnit(req)
    set((s) => ({ units: [...s.units, unit] }))
  },

  removeUnit: async (id) => {
    await api.deleteUnit(id)
    set((s) => ({
      units: s.units.filter((u) => u.id !== id),
      selectedUnitId: s.selectedUnitId === id ? null : s.selectedUnitId,
    }))
  },

  clearUnits: async (side) => {
    await api.clearUnits(side)
    set((s) => ({ units: s.units.filter((u) => u.side !== side) }))
  },

  reorientUnit: async (id, azimuth) => {
    const updated = await api.patchUnit(id, { azimuth })
    set((s) => ({ units: s.units.map((u) => u.id === id ? updated : u) }))
  },

  setScanning: (scanning) => set({ scanning }),
}))
