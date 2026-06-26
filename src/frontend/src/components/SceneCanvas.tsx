import { useEffect, useRef } from 'react'
import { Viewer } from '../engine/Viewer'
import { useStore } from '../lib/store'
import * as api from '../lib/api'

/** Mounts the three.js engine once and forwards store changes to it. */
export default function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const colorMode = useStore((s) => s.colorMode)
  const layers = useStore((s) => s.layers)
  const selected = useStore((s) => s.selected)

  useEffect(() => {
    if (!canvasRef.current) return
    let disposed = false
    const viewer = new Viewer(canvasRef.current)
    viewerRef.current = viewer
    if (import.meta.env.DEV) (window as unknown as { viewer: Viewer }).viewer = viewer
    viewer.onPick((b) => useStore.getState().select(b))

    ;(async () => {
      try {
        const [meta, boxes, viewshedInfo] = await Promise.all([
          api.fetchMeta(),
          api.fetchBoxes(),
          api.fetchViewshedInfo(),
        ])
        if (disposed) return
        useStore.getState().setData({ meta, boxes, viewshedInfo })
        const ready = await viewer.load(meta, boxes, viewshedInfo)
        if (!disposed) useStore.getState().setReady(ready)
      } catch (e) {
        if (!disposed) useStore.getState().setError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()

    return () => {
      disposed = true
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    viewerRef.current?.setColorMode(colorMode)
  }, [colorMode])

  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    ;(Object.keys(layers) as (keyof typeof layers)[]).forEach((k) => v.setLayer(k, layers[k]))
  }, [layers])

  useEffect(() => {
    viewerRef.current?.setSelected(selected?.id ?? null)
  }, [selected])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}
