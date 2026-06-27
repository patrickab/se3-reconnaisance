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
  const classVisibility = useStore((s) => s.classVisibility)
  const selected = useStore((s) => s.selected)

  useEffect(() => {
    if (!canvasRef.current) return
    let disposed = false
    const viewer = new Viewer(canvasRef.current)
    viewerRef.current = viewer
    if (import.meta.env.DEV) (window as unknown as { viewer: Viewer }).viewer = viewer
    viewer.onPick((b, point) => useStore.getState().select(b, point ?? null))
    viewer.onPickThreat((p, point) => useStore.getState().selectThreat(p, point ?? null))

    ;(async () => {
      try {
        const [meta, boxes, viewshedInfo, threatInfo, fieldsInfo] = await Promise.all([
          api.fetchMeta(),
          api.fetchBoxes(),
          api.fetchViewshedInfo(),
          api.fetchThreatInfo(),
          api.fetchFieldsInfo(),
        ])
        if (disposed) return
        useStore.getState().setData({ meta, boxes, viewshedInfo, threatInfo, fieldsInfo })
        const ready = await viewer.load(meta, boxes, viewshedInfo, threatInfo, fieldsInfo)
        viewer.setClassVisibility(useStore.getState().classVisibility)
        if (!disposed) useStore.getState().setReady({ viewshedReady: ready.viewshed, threatReady: ready.threat, fieldsReady: ready.fields })
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
    viewerRef.current?.setClassVisibility(classVisibility)
  }, [classVisibility])

  useEffect(() => {
    viewerRef.current?.setSelected(selected?.id ?? null)
  }, [selected])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}
