import { useEffect, useRef } from 'react'
import { Viewer } from '../engine/Viewer'
import { useStore } from '../lib/store'
import * as api from '../lib/api'

/** Mounts the three.js engine once and forwards store changes to it. */
export default function SceneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const viewshedRequestRef = useRef(0)
  const colorMode = useStore((s) => s.colorMode)
  const overlayOnRgb = useStore((s) => s.overlayOnRgb)
  const placing = useStore((s) => s.placing)
  const friendly = useStore((s) => s.friendly)
  const enemies = useStore((s) => s.enemies)
  const layers = useStore((s) => s.layers)
  const classVisibility = useStore((s) => s.classVisibility)
  const selected = useStore((s) => s.selected)
  const selectedCursor = useStore((s) => s.selectedCursor)

  useEffect(() => {
    if (!canvasRef.current) return
    let disposed = false
    const viewer = new Viewer(canvasRef.current)
    viewerRef.current = viewer
    if (import.meta.env.DEV) (window as unknown as { viewer: Viewer }).viewer = viewer
    viewer.onCursorScreen((screen) => useStore.getState().setSelectedCursorScreen(screen))
    viewer.onPick((b, cursor) => useStore.getState().select(b, cursor ?? null))
    viewer.onPickThreat((p, point) => useStore.getState().selectThreat(p, point ?? null))
    viewer.onPlaceFriendly((e, n, u) => useStore.getState().addFriendly(e, n, u))
    viewer.onPlaceEnemy((e, n, u) => useStore.getState().addEnemy(e, n, u))

    ;(async () => {
      try {
        const [meta, boxes, viewshedInfo, rawThreat, rawFields] = await Promise.all([
          api.fetchMeta(),
          api.fetchBoxes(),
          api.fetchViewshedInfo(),
          api.fetchThreatInfo(),
          api.fetchFieldsInfo(),
        ])
        if (disposed) return
        // The enemy is only revealed once the operator has placed their own troops and
        // scanned — never an auto/default laydown. Gate the whole threat picture on it.
        const analyzed = rawThreat?.avenue_source === 'operator'
        const threatInfo = analyzed ? rawThreat : null
        const fieldsInfo = analyzed ? rawFields : null
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
    viewerRef.current?.setOverlayOnRgb(overlayOnRgb)
  }, [overlayOnRgb])

  useEffect(() => {
    viewerRef.current?.setPlacing(placing)
  }, [placing])

  useEffect(() => {
    viewerRef.current?.setFriendlyMarkers(friendly)
  }, [friendly])

  useEffect(() => {
    viewerRef.current?.setEnemyMarkers(enemies)
  }, [enemies])

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

  useEffect(() => {
    viewerRef.current?.setCursorAnchor(selectedCursor?.world ?? null)
  }, [selectedCursor?.world])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || colorMode !== 'viewshed' || !selectedCursor) return
    const request = ++viewshedRequestRef.current
    api.fetchViewshedAt(selectedCursor.world)
      .then(({ flags, info }) => {
        if (request !== viewshedRequestRef.current || useStore.getState().colorMode !== 'viewshed') return
        viewer.setViewshed(flags, info)
        useStore.getState().setViewshed(info)
      })
      .catch((e) => {
        if (import.meta.env.DEV) console.warn(e)
      })
  }, [colorMode, selectedCursor?.world])

  return <canvas ref={canvasRef} className="block w-full h-full" />
}
