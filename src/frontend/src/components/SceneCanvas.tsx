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
  const removing = useStore((s) => s.removing)
  const activeSide = useStore((s) => s.activeSide)
  const activeUnitType = useStore((s) => s.activeUnitType)
  const units = useStore((s) => s.units)
  const layers = useStore((s) => s.layers)
  const classVisibility = useStore((s) => s.classVisibility)
  const selected = useStore((s) => s.selected)
  const selectedUnitId = useStore((s) => s.selectedUnitId)
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
    viewer.onPlaceFriendly((e, n, u, yaw_deg) => {
      const { activeUnitType: t } = useStore.getState()
      useStore.getState().placeUnit({ side: 'friendly', unit_type: t, world: [e, n, u], azimuth: yaw_deg, velocity: null })
    })
    viewer.onPlaceEnemy((e, n, u, yaw_deg) => {
      const { activeUnitType: t } = useStore.getState()
      useStore.getState().placeUnit({ side: 'hostile', unit_type: t, world: [e, n, u], azimuth: yaw_deg, velocity: null })
    })
    viewer.onRemoveUnit((id) => useStore.getState().removeUnit(id))
    viewer.onPickPlacedUnit((id, cursor) => useStore.getState().selectUnit(id, cursor))
    viewer.onReorientUnit((id, azimuth) => useStore.getState().reorientUnit(id, azimuth))

    ;(async () => {
      try {
        const [meta, boxes, viewshedInfo, rawThreat, rawFields, initialUnits, profiles] = await Promise.all([
          api.fetchMeta(),
          api.fetchBoxes(),
          api.fetchViewshedInfo(),
          api.fetchThreatInfo(),
          api.fetchFieldsInfo(),
          api.fetchUnits(),
          api.fetchUnitProfiles(),
        ])
        if (disposed) return
        const analyzed = rawThreat?.avenue_source === 'operator'
        const threatInfo = analyzed ? rawThreat : null
        const fieldsInfo = analyzed ? rawFields : null
        useStore.getState().setData({ meta, boxes, viewshedInfo, threatInfo, fieldsInfo })
        useStore.getState().setUnits(initialUnits)
        useStore.getState().setUnitProfiles(profiles)
        viewer.setUnitProfiles(profiles)
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

  useEffect(() => { viewerRef.current?.setColorMode(colorMode) }, [colorMode])
  useEffect(() => { viewerRef.current?.setOverlayOnRgb(overlayOnRgb) }, [overlayOnRgb])
  useEffect(() => { viewerRef.current?.setPlacing(placing) }, [placing])
  useEffect(() => { viewerRef.current?.setRemoving(removing) }, [removing])
  useEffect(() => { viewerRef.current?.setActiveSide(activeSide) }, [activeSide])
  useEffect(() => { viewerRef.current?.setActiveUnitType(activeUnitType) }, [activeUnitType])

  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    v.setEnemyMarkers(units.filter((u) => u.side === 'hostile'))
    v.setFriendlyMarkers(units.filter((u) => u.side === 'friendly'))
  }, [units])

  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    ;(Object.keys(layers) as (keyof typeof layers)[]).forEach((k) => v.setLayer(k, layers[k]))
  }, [layers])

  useEffect(() => { viewerRef.current?.setClassVisibility(classVisibility) }, [classVisibility])
  useEffect(() => { viewerRef.current?.setSelected(selected?.id ?? null) }, [selected])
  useEffect(() => { viewerRef.current?.setSelectedUnit(selectedUnitId) }, [selectedUnitId])
  useEffect(() => { viewerRef.current?.setCursorAnchor(selectedCursor?.world ?? null) }, [selectedCursor?.world])

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
