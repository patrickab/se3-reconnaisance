import { create } from 'zustand'
import { BoundingBox, CloudMeta, ColorMode, LayerKey, Layers, ViewshedInfo } from './types'

interface AppState {
  meta: CloudMeta | null
  boxes: BoundingBox[]
  viewshedInfo: ViewshedInfo | null
  viewshedReady: boolean
  loading: boolean
  error: string | null

  colorMode: ColorMode
  layers: Layers
  selected: BoundingBox | null

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null }) => void
  setReady: (viewshedReady: boolean) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  toggleLayer: (key: LayerKey) => void
  select: (selected: BoundingBox | null) => void
}

export const useStore = create<AppState>((set) => ({
  meta: null,
  boxes: [],
  viewshedInfo: null,
  viewshedReady: false,
  loading: true,
  error: null,

  colorMode: 'rgb',
  layers: { points: true, boxes: true, observer: true },
  selected: null,

  setData: (d) => set({ ...d, loading: false, error: null }),
  setReady: (viewshedReady) => set({ viewshedReady }),
  setError: (error) => set({ error, loading: false }),
  setColorMode: (colorMode) => set({ colorMode }),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
  select: (selected) => set({ selected }),
}))
