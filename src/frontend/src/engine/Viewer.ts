import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { BoundingBox, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo, WorldCoordinate } from '../lib/types'
import ms from 'milsymbol'
import { CLASS_COLORS, TURBO } from '../lib/colors'
import { fetchCloud, fetchViewshed, fetchThreat, fetchDanger, fetchDepth } from '../lib/api'
import { v2w, w2v } from '../lib/utils'

// NATO APP-6 / MIL-STD-2525 symbol codes (SIDC). Affiliation: H=hostile, F=friend.
// Both affiliations carry per-type icons so enemy and ally markers render with the
// same doctrinal shape — only affiliation colour (red/blue) differs.
const SIDC: Record<string, string> = {
  sniper_op: 'SHGPUCIS----',  // legacy key used by analyzed threat template
  sniper:    'SHGPUCIS----',
  tank:      'SHGPUCA-----',
  ifv:       'SHGPUCIZ----',  // mechanized/armored infantry (UCAI is not a valid SIDC → renders as ?)
  apc:       'SHGPUCI-----',
  assault:   'SHGPUCI-----',
  mortar:    'SHGPUCFM----',
  friendly:           'SFGPUCI-----',
  'friendly.sniper':  'SFGPUCIS----',
  'friendly.tank':    'SFGPUCA-----',
  'friendly.ifv':     'SFGPUCIZ----',
  'friendly.apc':     'SFGPUCI-----',
  'friendly.assault': 'SFGPUCI-----',
  'friendly.mortar':  'SFGPUCFM----',
}

function sidcFor(unit: UnitContact): string {
  if (unit.side === 'friendly') return SIDC[`friendly.${unit.unit_type}`] ?? SIDC.friendly
  return SIDC[unit.unit_type] ?? SIDC.sniper
}
// one CanvasTexture per SIDC, reused across markers
const symTex = new Map<string, THREE.Texture>()
function symbolTexture(sidc: string): THREE.Texture {
  let tex = symTex.get(sidc)
  if (!tex) {
    const canvas = new ms.Symbol(sidc, { size: 200 }).asCanvas()
    tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.userData.aspect = canvas.width / canvas.height
    symTex.set(sidc, tex)
  }
  return tex
}

// Module-level cache: the 54 MB cloud is fetched at most once per page load,
// surviving React StrictMode double-mounts and component remounts.
let cloudBuf: ArrayBuffer | null = null
let vsFlags: Uint8Array | null = null
let thFlags: Uint8Array | null = null
let dgFlags: Uint8Array | null = null
let dpFlags: Uint8Array | null = null

// engagement-area depth palette: 0 dead · 1 single · 2 cross-fire · 3+ kill zone
const DEPTH_PAL: [number, number, number][] = [
  [0.1, 0.11, 0.13], [0.9, 0.82, 0.27], [0.96, 0.59, 0.16], [0.92, 0.27, 0.16], [0.78, 0.12, 0.24], [0.66, 0.04, 0.35],
]

// Doctrinal catalog fetched from /api/unit-profiles (backend units.UNIT_CATALOG).
// Used only for the drag-preview envelope shown between placement and the
// /api/units round-trip; once a UnitContact comes back, its own eff_range_m /
// obs_arc drive the persisted marker's range ring + sector wedge.
let UNIT_PROFILES: Map<UnitType, UnitProfile> = new Map()
const FALLBACK_PROFILE: UnitProfile = {
  unit_type: 'sniper', label: 'Sniper / OP',
  weight_class: 'light', role: 'observer', fire_kind: 'direct',
  obs_arc: 60, eff_range_m: 800, max_range_m: 1300, height_agl_m: 1.7,
}

// sRGB → linear transfer (IEC 61966-2-1). Vertex colours must be linear because
// the renderer re-encodes to sRGB on output.
const srgb2lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/**
 * The three.js world. Created once, driven imperatively. React never touches
 * the scene graph — it calls these methods and lets the engine own the WebGL
 * lifecycle (init, render loop, dispose).
 */
export class Viewer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private ro: ResizeObserver
  private raf = 0
  private clock = new THREE.Clock()
  private keys = new Set<string>()

  private points?: THREE.Points
  private meta?: CloudMeta
  private colors: Partial<Record<ColorMode, THREE.BufferAttribute>> = {}
  private boxGroup = new THREE.Group()
  private observerGroup = new THREE.Group()
  private threatGroup = new THREE.Group()
  private friendlyGroup = new THREE.Group()
  private placedEnemyGroup = new THREE.Group()
  private viewconesGroup = new THREE.Group()
  private enemyOrientGroup = new THREE.Group()
  private threatPickables: THREE.Object3D[] = []
  private pickCb: (box: BoundingBox | null, cursor?: SceneCursor) => void = () => {}
  private placing: 'enemy' | 'friendly' | null = null
  private removing = false
  private activeSide: 'hostile' | 'friendly' = 'hostile'
  private placeCb: (e: number, n: number, u: number, yaw_deg: number) => void = () => {}
  private placeEnemyCb: (e: number, n: number, u: number, yaw_deg: number) => void = () => {}
  private pendingEnemyPin: { vx: number; vy: number; vz: number; E: number; N: number; U: number } | null = null
  private reorientPin: { unitId: string; vx: number; vy: number; vz: number; color: number } | null = null
  private reorientCb: (id: string, azimuth: number) => void = () => {}
  private activeUnitType: UnitType = 'sniper'
  private placedUnitPickables: THREE.Object3D[] = []
  private unitById = new Map<string, UnitContact>()
  private selectedUnitId: string | null = null
  private removeUnitCb: (id: string) => void = () => {}
  private pickPlacedUnitCb: (id: string, cursor: SceneCursor) => void = () => {}
  private pickThreatCb: (p: ThreatPosition | null, point?: { x: number; y: number }) => void = () => {}
  private cursorScreenCb: (screen: ScreenPoint) => void = () => {}
  private cursorAnchor?: WorldCoordinate
  private lastCursorScreen?: ScreenPoint
  private boxById = new Map<string, BoundingBox>()
  private boxTempMin = 0
  private boxTempMax = 1
  private colorMode: ColorMode = 'rgb'
  private overlayOnRgb = false
  private colRGBArr?: Float32Array   // linear RGB base, for blending overlays onto the real map
  private blendBuf?: Float32Array

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x080c10)
    this.scene.add(this.boxGroup, this.observerGroup, this.threatGroup, this.friendlyGroup, this.placedEnemyGroup, this.viewconesGroup, this.enemyOrientGroup)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 20000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.raycaster.params.Points.threshold = 2.5

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    canvas.addEventListener('click', this.onClick)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('mousedown', this.onPlaceMouseDown)
    canvas.addEventListener('mousemove', this.onPlaceMouseMove)
    canvas.addEventListener('mouseup', this.onPlaceMouseUp)
    addEventListener('keydown', this.onKey)
    addEventListener('keyup', this.onKey)

    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.apply(this.clock.getDelta())
      this.controls.update()
      this.emitCursorScreen()
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  /** Fetch the cloud + viewshed + threat and build the whole scene. Idempotent. */
  async load(meta: CloudMeta, boxes: BoundingBox[], vs: ViewshedInfo | null,
             threat: ThreatInfo | null, fields: FieldsInfo | null): Promise<{ viewshed: boolean; threat: boolean; fields: boolean }> {
    this.meta = meta
    const [, , sz] = meta.span
    const [sx, sy] = meta.span

    if (!cloudBuf) cloudBuf = await fetchCloud()
    if (vs && !vsFlags) vsFlags = await fetchViewshed()
    if (threat && !thFlags) thFlags = await fetchThreat()
    if (fields && !dgFlags) dgFlags = await fetchDanger()
    if (fields && !dpFlags) dpFlags = await fetchDepth()

    const { n } = meta
    const pos = new Float32Array(cloudBuf, 0, n * 3)
    const rgb = new Uint8Array(cloudBuf, n * 3 * 4, n * 3)

    const positions = new Float32Array(n * 3)
    const colRGB = new Float32Array(n * 3)
    const colHGT = new Float32Array(n * 3)
    let zmin = Infinity
    let zmax = -Infinity
    for (let i = 0; i < n; i++) {
      const u = pos[i * 3 + 2]
      if (u < zmin) zmin = u
      if (u > zmax) zmax = u
    }
    const zr = zmax - zmin || 1
    // The renderer outputs sRGB; vertex colours aren't auto-converted, so feed
    // it linear. LUT maps the scan's 0-255 sRGB channels → linear once.
    const s2l = new Float32Array(256)
    for (let i = 0; i < 256; i++) s2l[i] = srgb2lin(i / 255)
    // origin cancels out (served points are local): view = local - span/2
    for (let i = 0; i < n; i++) {
      const e = pos[i * 3]
      const nn = pos[i * 3 + 1]
      const u = pos[i * 3 + 2]
      positions[i * 3] = e - sx / 2
      positions[i * 3 + 1] = u - sz / 2
      positions[i * 3 + 2] = -(nn - sy / 2)
      colRGB[i * 3] = s2l[rgb[i * 3]]
      colRGB[i * 3 + 1] = s2l[rgb[i * 3 + 1]]
      colRGB[i * 3 + 2] = s2l[rgb[i * 3 + 2]]
      const c = TURBO((u - zmin) / zr)
      colHGT[i * 3] = srgb2lin(c[0])
      colHGT[i * 3 + 1] = srgb2lin(c[1])
      colHGT[i * 3 + 2] = srgb2lin(c[2])
    }

    this.colors.rgb = new THREE.BufferAttribute(colRGB, 3)
    this.colors.height = new THREE.BufferAttribute(colHGT, 3)
    this.colRGBArr = colRGB
    if (vsFlags) this.colors.viewshed = this.buildViewshedColors(vsFlags)
    if (thFlags) {
      const colTH = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const v = thFlags[i] / 255
        if (v < 0.04) {
          colTH[i * 3] = srgb2lin(0.1) // cold = unlikely enemy position
          colTH[i * 3 + 1] = srgb2lin(0.11)
          colTH[i * 3 + 2] = srgb2lin(0.13)
        } else {
          const c = TURBO(v) // turbo heatmap = how well the position dominates our approach
          colTH[i * 3] = srgb2lin(c[0])
          colTH[i * 3 + 1] = srgb2lin(c[1])
          colTH[i * 3 + 2] = srgb2lin(c[2])
        }
      }
      this.colors.threat = new THREE.BufferAttribute(colTH, 3)
    }
    if (dgFlags) {
      const colDG = new Float32Array(n * 3) // continuous danger/cost surface (turbo)
      for (let i = 0; i < n; i++) {
        const v = dgFlags[i] / 255
        const c = v < 0.04 ? [0.1, 0.11, 0.13] : TURBO(v)
        colDG[i * 3] = srgb2lin(c[0])
        colDG[i * 3 + 1] = srgb2lin(c[1])
        colDG[i * 3 + 2] = srgb2lin(c[2])
      }
      this.colors.danger = new THREE.BufferAttribute(colDG, 3)
    }
    if (dpFlags) {
      const colDP = new Float32Array(n * 3) // engagement-area depth (overlapping fields of fire)
      for (let i = 0; i < n; i++) {
        const c = DEPTH_PAL[Math.min(dpFlags[i], DEPTH_PAL.length - 1)]
        colDP[i * 3] = srgb2lin(c[0])
        colDP[i * 3 + 1] = srgb2lin(c[1])
        colDP[i * 3 + 2] = srgb2lin(c[2])
      }
      this.colors.depth = new THREE.BufferAttribute(colDP, 3)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', this.colors.rgb)
    geo.computeBoundingSphere()
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.82, vertexColors: true, sizeAttenuation: true })
    )
    this.scene.add(this.points)

    this.buildBoxes(boxes, meta)
    if (vs) this.buildObserver(vs, meta)
    if (threat) this.buildThreat(threat, meta)
    if (fields) this.buildTRPs(fields, meta)

    const d = Math.max(sx, sy)
    this.camera.position.set(0, d * 0.55, d * 0.85)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.resize()
    return { viewshed: true, threat: !!thFlags, fields: !!dgFlags }
  }

  setColorMode(mode: ColorMode) {
    this.colorMode = mode
    const blended = this.overlayOnRgb ? this.blendedOverlay(mode) : null
    const attr = blended ?? this.colors[mode] ?? this.colors.rgb
    if (this.points && attr) {
      this.points.geometry.setAttribute('color', attr)
      attr.needsUpdate = true
    }
    this.updateBoxColors()
  }

  setOverlayOnRgb(on: boolean) {
    this.overlayOnRgb = on
    this.setColorMode(this.colorMode)
  }

  // Composite a threat overlay over the real photographic colours: out = rgb*(1-a) + tint*a,
  // where the tint's strength (a) scales with how "hot" the cell is. Lets you read the
  // danger/kill-zone/viewshed on the actual map instead of a flat heatmap. Null = no overlay
  // for this mode (rgb/height/temperature), so the pure attribute is used.
  private blendedOverlay(mode: ColorMode): THREE.BufferAttribute | null {
    const flags = mode === 'viewshed' ? vsFlags : mode === 'threat' ? thFlags
      : mode === 'danger' ? dgFlags : mode === 'depth' ? dpFlags : null
    if (!flags || !this.colRGBArr) return null
    const base = this.colRGBArr
    const n = base.length / 3
    if (!this.blendBuf) this.blendBuf = new Float32Array(n * 3)
    const out = this.blendBuf
    for (let i = 0; i < n; i++) {
      let r = 0, g = 0, b = 0, a = 0
      if (mode === 'viewshed') {
        if (flags[i]) { r = 1; g = 0.18; b = 0.18; a = 0.6 } else { r = 0.12; g = 0.72; b = 0.4; a = 0.3 }
      } else if (mode === 'depth') {
        const d = Math.min(flags[i], DEPTH_PAL.length - 1)
        const c = DEPTH_PAL[d]; r = c[0]; g = c[1]; b = c[2]; a = d === 0 ? 0 : Math.min(0.85, 0.45 + 0.12 * d)
      } else { // threat / danger — turbo, strength = value
        const v = flags[i] / 255
        if (v >= 0.04) { const c = TURBO(v); r = c[0]; g = c[1]; b = c[2]; a = v * 0.85 }
      }
      out[i * 3] = base[i * 3] * (1 - a) + srgb2lin(r) * a
      out[i * 3 + 1] = base[i * 3 + 1] * (1 - a) + srgb2lin(g) * a
      out[i * 3 + 2] = base[i * 3 + 2] * (1 - a) + srgb2lin(b) * a
    }
    return new THREE.BufferAttribute(out, 3)
  }

  setLayer(key: LayerKey, visible: boolean) {
    if (key === 'points' && this.points) this.points.visible = visible
    if (key === 'boxes') this.boxGroup.visible = visible
    if (key === 'observer') this.observerGroup.visible = visible
    // enemy markers now live in placedEnemyGroup (live /api/units); threatGroup holds only
    // the advance-axis arrow. "hide enemy markers" should hide the actual enemy markers.
    if (key === 'threats') { this.placedEnemyGroup.visible = visible; this.threatGroup.visible = visible }
    if (key === 'viewcones') this.viewconesGroup.visible = visible
  }

  setClassVisibility(visibility: ClassVisibility) {
    this.boxGroup.children.forEach((m) => {
      const mesh = m as THREE.Mesh
      mesh.visible = visibility[mesh.userData.classLabel as keyof ClassVisibility]
    })
  }

  setSelected(id: string | null) {
    this.boxGroup.children.forEach((m) => {
      const mesh = m as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = mesh.userData.id === id ? 0.55 : 0.2
    })
  }

  // Reveal a placed unit's full range ring/wedge only while it's selected.
  setSelectedUnit(id: string | null) {
    this.selectedUnitId = id
    for (const g of [this.placedEnemyGroup, this.friendlyGroup]) {
      for (const c of g.children) {
        if (c.userData.selOnly) c.visible = c.userData.unitId === id
      }
    }
  }

  setViewshed(flags: Uint8Array, info: ViewshedInfo) {
    if (!this.meta) return
    vsFlags = flags
    this.colors.viewshed = this.buildViewshedColors(flags)
    this.buildObserver(info, this.meta)
    if (this.colorMode === 'viewshed') this.setColorMode('viewshed')
  }

  onPick(cb: (box: BoundingBox | null, cursor?: SceneCursor) => void) {
    this.pickCb = cb
  }

  onPickThreat(cb: (p: ThreatPosition | null, point?: { x: number; y: number }) => void) {
    this.pickThreatCb = cb
  }

  onCursorScreen(cb: (screen: ScreenPoint) => void) {
    this.cursorScreenCb = cb
  }

  setCursorAnchor(world: WorldCoordinate | null) {
    this.cursorAnchor = world ?? undefined
    this.lastCursorScreen = undefined
    this.emitCursorScreen()
  }

  // ---- operator placement (enemy from intel, or our own positions) ----
  setPlacing(mode: 'enemy' | 'friendly' | null) {
    this.placing = mode
    this.canvas.style.cursor = mode || this.removing ? 'crosshair' : 'default'
  }

  setRemoving(on: boolean) {
    this.removing = on
    this.canvas.style.cursor = on || this.placing ? 'crosshair' : 'default'
  }

  setActiveUnitType(t: UnitType) { this.activeUnitType = t }
  setActiveSide(s: 'hostile' | 'friendly') { this.activeSide = s }

  /** Receive the doctrinal catalog from /api/unit-profiles. Drag-preview rings
   *  for operator placement read range/arc from here, never from a hardcoded table. */
  setUnitProfiles(profiles: UnitProfile[]) {
    UNIT_PROFILES = new Map(profiles.map((p) => [p.unit_type, p]))
  }

  private profileFor(t: UnitType): UnitProfile {
    return UNIT_PROFILES.get(t) ?? FALLBACK_PROFILE
  }

  onPlaceFriendly(cb: (e: number, n: number, u: number, yaw_deg: number) => void) {
    this.placeCb = cb
  }

  onPlaceEnemy(cb: (e: number, n: number, u: number, yaw_deg: number) => void) {
    this.placeEnemyCb = cb
  }

  onRemoveUnit(cb: (id: string) => void) { this.removeUnitCb = cb }
  onPickPlacedUnit(cb: (id: string, cursor: SceneCursor) => void) { this.pickPlacedUnitCb = cb }
  onReorientUnit(cb: (id: string, azimuth: number) => void) { this.reorientCb = cb }

  setEnemyMarkers(units: UnitContact[]) {
    this.placeContacts(units, 'hostile', this.placedEnemyGroup, 0xff2b2b)
  }

  setFriendlyMarkers(units: UnitContact[]) {
    this.placeContacts(units, 'friendly', this.friendlyGroup, 0x3b82f6)
  }

  /** Builds a placed-contact marker — pole, NATO icon (azimuth-rotated), ground
   *  ring, and range/sector overlay. Enemy (red) and ally (blue) render with
   *  identical geometry; only affiliation colour differs, so both sides behave
   *  the same in the UI. */
  private placeContacts(units: UnitContact[], side: 'hostile' | 'friendly', group: THREE.Group, color: number) {
    this.clearGroup(group)
    // also remove this side's cones from the shared viewconesGroup
    for (const c of [...this.viewconesGroup.children]) {
      if (c.userData.side === side) {
        this.viewconesGroup.remove(c);
        (c as THREE.Mesh).geometry?.dispose?.();
        ((c as THREE.Mesh).material as THREE.Material)?.dispose?.()
      }
    }
    this.placedUnitPickables = this.placedUnitPickables.filter((p) => p.userData.side !== side)
    for (const [id, u] of this.unitById) if (u.side === side) this.unitById.delete(id)
    if (!this.meta) return
    for (const unit of units) {
      this.unitById.set(unit.id, unit)
      const [vx, vy, vz] = w2v(unit.world, this.meta.origin, this.meta.span)
      const top = vy + 26
      const icon = this.symbolSprite(sidcFor(unit), 15)
      icon.position.set(vx, top, vz)
      if (unit.azimuth != null) icon.rotation.y = unit.azimuth * Math.PI / 180
      icon.userData.unitId = unit.id
      icon.userData.side = side
      icon.userData.world = unit.world
      this.placedUnitPickables.push(icon)
      const pole = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(vx, vy, vz), new THREE.Vector3(vx, top, vz)]),
        new THREE.LineBasicMaterial({ color })
      )
      const ring = this.decal(new THREE.Mesh(
        new THREE.RingGeometry(8, 12, 28),
        new THREE.MeshBasicMaterial({ color, opacity: 0.8, side: THREE.DoubleSide })
      ))
      ring.rotation.x = -Math.PI / 2
      ring.position.set(vx, vy + 0.3, vz)
      ring.userData.unitId = unit.id
      ring.userData.selOnly = true
      ring.visible = unit.id === this.selectedUnitId
      const { dir, ranged } = this.rangeOverlay(vx, vy, vz, unit.azimuth ?? 0, {
        unit_type: unit.unit_type, label: unit.label,
        weight_class: unit.weight_class, role: unit.role, fire_kind: unit.fire_kind,
        obs_arc: unit.obs_arc, eff_range_m: unit.eff_range_m,
        max_range_m: unit.max_range_m, height_agl_m: unit.height_agl_m,
      }, color)
      for (const o of ranged) {
        o.userData.unitId = unit.id
        o.userData.selOnly = true
        o.visible = unit.id === this.selectedUnitId
      }
      for (const d of dir) d.userData.side = side
      this.viewconesGroup.add(...dir)
      group.add(icon, pole, ring, ...ranged)
    }
  }

  private clearGroup(g: THREE.Group) {
    for (const c of [...g.children]) {
      g.remove(c)
      // sprites share one module-level geometry — disposing it would churn every other sprite
      if (!(c as THREE.Sprite).isSprite) (c as THREE.Mesh).geometry?.dispose?.()
      const m = (c as THREE.Mesh).material as THREE.Material | undefined
      m?.dispose?.()
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.canvas.removeEventListener('click', this.onClick)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    this.canvas.removeEventListener('mousedown', this.onPlaceMouseDown)
    this.canvas.removeEventListener('mousemove', this.onPlaceMouseMove)
    this.canvas.removeEventListener('mouseup', this.onPlaceMouseUp)
    removeEventListener('keydown', this.onKey)
    removeEventListener('keyup', this.onKey)
    this.controls.dispose()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.renderer.dispose()
  }

  // ---- internals ----

  private buildBoxes(boxes: BoundingBox[], meta: CloudMeta) {
    this.boxTempMin = Math.min(...boxes.map((b) => b.avg_temperature))
    this.boxTempMax = Math.max(...boxes.map((b) => b.avg_temperature))
    for (const b of boxes) {
      const [lx, ly, lz] = b.extent
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(lx, lz, ly),
        new THREE.MeshBasicMaterial({
          color: CLASS_COLORS[b.class_label] ?? 0xffffff,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      const [vx, vy, vz] = w2v(b.center, meta.origin, meta.span)
      mesh.position.set(vx, vy, vz)
      mesh.rotation.y = 2 * Math.atan2(b.rotation[2], b.rotation[3])
      mesh.userData.id = b.id
      mesh.userData.classLabel = b.class_label
      mesh.userData.temperature = b.avg_temperature
      this.boxGroup.add(mesh)
      this.boxById.set(b.id, b)
    }
    this.updateBoxColors()
  }

  private updateBoxColors() {
    const tempRange = this.boxTempMax - this.boxTempMin || 1
    this.boxGroup.children.forEach((m) => {
      const mesh = m as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      if (this.colorMode === 'temperature') {
        const t = ((mesh.userData.temperature as number) - this.boxTempMin) / tempRange
        const [r, g, b] = TURBO(t)
        mat.color.setRGB(r, g, b)
      } else {
        mat.color.setHex(CLASS_COLORS[mesh.userData.classLabel as string] ?? 0xffffff)
      }
    })
  }

  // Likely enemy positions (threat template output) → distinct 3D assets:
  // ◆ sniper/OP · ▮ tank · ⬢ mortar. The markers ARE the verification.
  // Flat ground overlays (rings, sector wedges, crosshairs) must render ON TOP of the
  // cloud — otherwise they sit at the scene's min elevation and get buried under the
  // undulating terrain (only visible from underneath). depthTest off + high renderOrder.
  private decal<T extends THREE.Mesh>(mesh: T): T {
    const m = mesh.material as THREE.MeshBasicMaterial
    m.depthTest = false
    m.depthWrite = false
    m.transparent = true
    mesh.renderOrder = 4
    return mesh
  }

  // thetaStart maps compass yaw to THREE.CircleGeometry theta (0=east after rotation.x=-PI/2).
  // `dir`: short facing cone (orientation + view angle) always shown for the RGB overview.
  // `ranged`: full eff-range ring + wedge, revealed only when the unit is selected —
  // the accurate engagement picture lives in danger/depth color modes.
  private static DIR_R = 70 // m — glance-first facing cone, not the full weapon range
  private rangeOverlay(
    vx: number, vy: number, vz: number, yaw_deg: number, profile: UnitProfile, color = 0xff2b2b,
  ): { dir: THREE.Object3D[]; ranged: THREE.Object3D[] } {
    const r = profile.eff_range_m
    const sector = profile.obs_arc > 0 && profile.obs_arc < 360
    const arc = sector ? profile.obs_arc : 360
    const thetaStart = (90 - yaw_deg - arc / 2) * Math.PI / 180

    const dir = this.decal(new THREE.Mesh(
      new THREE.CircleGeometry(Viewer.DIR_R, 40, thetaStart, arc * Math.PI / 180),
      new THREE.MeshBasicMaterial({ color, opacity: 0.28, side: THREE.DoubleSide })
    ))
    dir.renderOrder = 3
    dir.rotation.x = -Math.PI / 2
    dir.position.set(vx, vy + 0.2, vz)

    const ring = this.decal(new THREE.Mesh(
      new THREE.RingGeometry(r - 3, r + 3, 80),
      new THREE.MeshBasicMaterial({ color, opacity: 0.45, side: THREE.DoubleSide })
    ))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(vx, vy + 0.3, vz)
    const ranged: THREE.Object3D[] = [ring]
    if (sector) {
      const wedge = this.decal(new THREE.Mesh(
        new THREE.CircleGeometry(r, 60, thetaStart, arc * Math.PI / 180),
        new THREE.MeshBasicMaterial({ color, opacity: 0.1, side: THREE.DoubleSide })
      ))
      wedge.renderOrder = 3
      wedge.rotation.x = -Math.PI / 2
      wedge.position.set(vx, vy + 0.2, vz)
      ranged.push(wedge)
    }
    return { dir: [dir], ranged }
  }

  /** A billboarded NATO/APP-6 unit symbol — always faces the camera, always drawn on top. */
  private symbolSprite(sidc: string, worldH = 14): THREE.Sprite {
    const tex = symbolTexture(sidc)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    const aspect = (tex.userData.aspect as number) ?? 1
    sprite.scale.set(worldH * aspect, worldH, 1)
    sprite.renderOrder = 6
    return sprite
  }

  private buildThreat(threat: ThreatInfo, meta: CloudMeta) {
    // Enemy AND friendly unit markers (icon + pole + ring + range/sector overlay) are drawn
    // from the live /api/units store by placeContacts(). The analysed laydown must NOT redraw
    // them — doing so stacked a second marker on every unit after 'analyse' (the doubling bug).
    // The only laydown-specific overlay left here is the advance-axis arrow; TRPs are drawn by
    // buildTRPs(), the kill-zone/danger surface is the per-point colour overlay.
    if (!threat.avenue?.length) return
    const FRIEND = 0x3b82f6
    const mu = threat.avenue.reduce((s, p) => s + p[2], 0) / threat.avenue.length
    const [cE, cN] = threat.avenue_centroid
    const [sx0, sy0, sz0] = w2v([cE, cN, mu], meta.origin, meta.span)
    const dir = new THREE.Vector3(-sx0, 0, -sz0).normalize() // toward objective (scene centre)
    this.threatGroup.add(new THREE.ArrowHelper(dir, new THREE.Vector3(sx0, sy0 + 18, sz0), 150, FRIEND, 40, 24))
  }

  // Pre-planned mortar target points on chokepoints (cyan crosshair markers).
  private buildTRPs(fields: FieldsInfo, meta: CloudMeta) {
    const TRP = 0x22d3d3
    const groundY = -meta.span[2] / 2
    for (const [E, N] of fields.trps) {
      const [vx, , vz] = w2v([E, N, meta.origin[2]], meta.origin, meta.span)
      const ring = this.decal(new THREE.Mesh(
        new THREE.RingGeometry(6, 9, 28),
        new THREE.MeshBasicMaterial({ color: TRP, opacity: 0.9, side: THREE.DoubleSide })
      ))
      ring.rotation.x = -Math.PI / 2
      ring.position.set(vx, groundY + 0.4, vz)
      const bar = this.decal(new THREE.Mesh(new THREE.BoxGeometry(16, 1, 2), new THREE.MeshBasicMaterial({ color: TRP })))
      bar.position.set(vx, groundY + 0.5, vz)
      const bar2 = bar.clone()
      bar2.rotation.y = Math.PI / 2
      this.threatGroup.add(ring, bar, bar2)
    }
  }

  private buildViewshedColors(flags: Uint8Array) {
    const colVS = new Float32Array(flags.length * 3)
    for (let i = 0; i < flags.length; i++) {
      const seen = flags[i]
      colVS[i * 3] = srgb2lin(seen ? 1 : 0.12) // seen → red, dead ground → green
      colVS[i * 3 + 1] = srgb2lin(seen ? 0.18 : 0.72)
      colVS[i * 3 + 2] = srgb2lin(seen ? 0.18 : 0.4)
    }
    return new THREE.BufferAttribute(colVS, 3)
  }

  private buildObserver(vs: ViewshedInfo, meta: CloudMeta) {
    this.clearObserver()
    const [vx, vy, vz] = w2v(vs.observer_world, meta.origin, meta.span)
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(6),
      new THREE.MeshBasicMaterial({ color: 0xffe14d })
    )
    marker.position.set(vx, vy, vz)
    this.observerGroup.add(marker)
  }

  private clearObserver() {
    this.observerGroup.children.forEach((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[]
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.observerGroup.clear()
  }

  private onKey = (e: KeyboardEvent) => {
    // Only swallow keys while typing — a focused checkbox/button must not kill nav.
    const t = e.target as HTMLElement
    const typing =
      t.isContentEditable ||
      t.tagName === 'TEXTAREA' ||
      (t.tagName === 'INPUT' &&
        !['checkbox', 'radio', 'button', 'range', 'submit'].includes((t as HTMLInputElement).type))
    if (typing) return
    // WASD/QE move position, arrows orient the camera.
    const map: Record<string, string> = {
      KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right', KeyE: 'up', KeyQ: 'down',
      ArrowLeft: 'yawL', ArrowRight: 'yawR', ArrowUp: 'pitchU', ArrowDown: 'pitchD',
    }
    const k = map[e.code]
    if (!k) return
    e.preventDefault()
    if (e.type === 'keydown') this.keys.add(k)
    else this.keys.delete(k)
  }

  private apply(dt: number) {
    if (!this.keys.size) return
    this.move(dt)
    this.orient(dt)
  }

  // WASD/QE: pan camera + target together; speed scales with zoom.
  private move(dt: number) {
    // Use the camera's own right axis (matrix col 0) — robust even looking down,
    // unlike crossing the look-dir with up (degenerate near top-down).
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    right.y = 0
    if (right.lengthSq() < 1e-6) return
    right.normalize()
    const fwd = new THREE.Vector3().crossVectors(this.camera.up, right).normalize()
    const m = new THREE.Vector3()
    if (this.keys.has('fwd')) m.add(fwd)
    if (this.keys.has('back')) m.sub(fwd)
    if (this.keys.has('right')) m.add(right)
    if (this.keys.has('left')) m.sub(right)
    if (this.keys.has('up')) m.y += 1
    if (this.keys.has('down')) m.y -= 1
    if (!m.lengthSq()) return
    m.normalize().multiplyScalar(this.camera.position.distanceTo(this.controls.target) * 1.2 * dt)
    this.camera.position.add(m)
    this.controls.target.add(m)
  }

  // Arrows: look around in place — rotate the target about the camera (the
  // camera is the pivot), so it feels like turning your head while flying.
  private orient(dt: number) {
    let dTheta = 0
    let dPhi = 0
    const r = 1.4 * dt
    if (this.keys.has('yawL')) dTheta += r
    if (this.keys.has('yawR')) dTheta -= r
    if (this.keys.has('pitchU')) dPhi -= r
    if (this.keys.has('pitchD')) dPhi += r
    if (!dTheta && !dPhi) return
    const dir = this.controls.target.clone().sub(this.camera.position)
    const sph = new THREE.Spherical().setFromVector3(dir)
    sph.theta += dTheta
    sph.phi = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi + dPhi))
    // camera stays put; target swings around it → look-in-place
    this.controls.target.copy(this.camera.position).add(dir.setFromSpherical(sph))
  }

  private resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private emitCursorScreen() {
    if (!this.meta || !this.cursorAnchor) return
    const [x, y, z] = w2v(this.cursorAnchor, this.meta.origin, this.meta.span)
    const projected = new THREE.Vector3(x, y, z).project(this.camera)
    const r = this.canvas.getBoundingClientRect()
    const screen = {
      x: r.left + (projected.x * 0.5 + 0.5) * r.width,
      y: r.top + (-projected.y * 0.5 + 0.5) * r.height,
    }
    if (
      this.lastCursorScreen &&
      Math.abs(this.lastCursorScreen.x - screen.x) < 0.5 &&
      Math.abs(this.lastCursorScreen.y - screen.y) < 0.5
    ) return
    this.lastCursorScreen = screen
    this.cursorScreenCb(screen)
  }

  private toNDC(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect()
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    )
  }

  private yawFromPinToViewer(vx: number, vz: number, hitX: number, hitZ: number) {
    // north = -Z in viewer space; yaw = angle from north, clockwise
    return Math.atan2(hitX - vx, -(hitZ - vz)) * 180 / Math.PI
  }

  private onPlaceMouseDown = (e: MouseEvent) => {
    if (!this.meta || !this.points) return
    // reorient: drag from an existing icon (only when not in place/remove mode)
    if (!this.placing && !this.removing) {
      this.raycaster.setFromCamera(this.toNDC(e), this.camera)
      const iconHit = this.raycaster.intersectObjects(this.placedUnitPickables, false)[0]
      if (iconHit) {
        const id = iconHit.object.userData.unitId as string
        const side = iconHit.object.userData.side as 'hostile' | 'friendly'
        const color = side === 'hostile' ? 0xff2b2b : 0x3b82f6
        const ip = iconHit.object.position
        this.reorientPin = { unitId: id, vx: ip.x, vy: ip.y - 26, vz: ip.z, color }
        this.controls.enabled = false
        return
      }
    }
    if (!this.placing) return
    this.raycaster.setFromCamera(this.toNDC(e), this.camera)
    const hit = this.raycaster.intersectObject(this.points, false)[0]
    if (!hit) return
    const E = hit.point.x + (this.meta.origin[0] + this.meta.span[0] / 2)
    const N = (this.meta.origin[1] + this.meta.span[1] / 2) - hit.point.z
    const U = hit.point.y + (this.meta.origin[2] + this.meta.span[2] / 2)
    this.pendingEnemyPin = { vx: hit.point.x, vy: hit.point.y, vz: hit.point.z, E, N, U }
    this.controls.enabled = false
    this.clearGroup(this.enemyOrientGroup)
    const { vx: px, vy: py, vz: pz } = this.pendingEnemyPin
    const color = this.activeSide === 'hostile' ? 0xff2b2b : 0x3b82f6
    const stub = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, py, pz), new THREE.Vector3(px, py + 26, pz)]),
      new THREE.LineBasicMaterial({ color })
    )
    const profile = this.profileFor(this.activeUnitType)
    const ov = this.rangeOverlay(px, py, pz, 0, profile, color)
    this.enemyOrientGroup.add(stub, ...ov.dir, ...ov.ranged)
  }

  private onPlaceMouseMove = (e: MouseEvent) => {
    if (!(e.buttons & 1)) return
    // reorient drag: update the cone live while dragging from an icon
    if (this.reorientPin && this.meta && this.points) {
      this.raycaster.setFromCamera(this.toNDC(e), this.camera)
      const hit = this.raycaster.intersectObject(this.points, false)[0]
      if (!hit) return
      const { vx, vy, vz, unitId, color } = this.reorientPin
      const yaw = this.yawFromPinToViewer(vx, vz, hit.point.x, hit.point.z)
      // update the icon rotation live
      const icon = this.placedUnitPickables.find((p) => p.userData.unitId === unitId)
      if (icon) icon.rotation.y = yaw * Math.PI / 180
      // update the view cone live
      for (const c of [...this.viewconesGroup.children]) {
        if (c.userData.unitId === unitId) {
          this.viewconesGroup.remove(c);
          (c as THREE.Mesh).geometry?.dispose?.();
          ((c as THREE.Mesh).material as THREE.Material)?.dispose?.()
        }
      }
      const unit = this.unitById.get(unitId)
      if (unit) {
        const { dir } = this.rangeOverlay(vx, vy, vz, yaw, unit, color)
        for (const d of dir) { d.userData.side = unit.side; d.userData.unitId = unitId }
        this.viewconesGroup.add(...dir)
      }
      return
    }
    if (!this.pendingEnemyPin || !this.meta || !this.points) return
    this.raycaster.setFromCamera(this.toNDC(e), this.camera)
    const hit = this.raycaster.intersectObject(this.points, false)[0]
    if (!hit) return
    const { vx: px, vy: py, vz: pz } = this.pendingEnemyPin
    const yaw = this.yawFromPinToViewer(px, pz, hit.point.x, hit.point.z)
    const yaw_rad = yaw * Math.PI / 180
    const len = 40
    const dx = Math.sin(yaw_rad) * len
    const dz = -Math.cos(yaw_rad) * len
    this.clearGroup(this.enemyOrientGroup)
    const color = this.activeSide === 'hostile' ? 0xff2b2b : 0x3b82f6
    const top = py + 26
    const pole = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, py, pz), new THREE.Vector3(px, top, pz)]),
      new THREE.LineBasicMaterial({ color })
    )
    const arrow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, top, pz), new THREE.Vector3(px + dx, top, pz + dz)]),
      new THREE.LineBasicMaterial({ color })
    )
    const profile = this.profileFor(this.activeUnitType)
    const ov = this.rangeOverlay(px, py, pz, yaw, profile, color)
    this.enemyOrientGroup.add(pole, arrow, ...ov.dir, ...ov.ranged)
  }

  private onPlaceMouseUp = (e: MouseEvent) => {
    if (this.reorientPin && this.meta && this.points) {
      const { unitId, vx, vz } = this.reorientPin
      this.reorientPin = null
      this.controls.enabled = true
      this.raycaster.setFromCamera(this.toNDC(e), this.camera)
      const hit = this.raycaster.intersectObject(this.points, false)[0]
      if (hit) {
        const yaw = this.yawFromPinToViewer(vx, vz, hit.point.x, hit.point.z)
        this.reorientCb(unitId, yaw)
      }
      return
    }
    if (!this.pendingEnemyPin || !this.meta || !this.points) return
    const pin = this.pendingEnemyPin
    this.pendingEnemyPin = null
    this.controls.enabled = true
    this.clearGroup(this.enemyOrientGroup)
    this.raycaster.setFromCamera(this.toNDC(e), this.camera)
    const hit = this.raycaster.intersectObject(this.points, false)[0]
    const yaw = hit ? this.yawFromPinToViewer(pin.vx, pin.vz, hit.point.x, hit.point.z) : 0
    if (this.activeSide === 'hostile') this.placeEnemyCb(pin.E, pin.N, pin.U, yaw)
    else this.placeCb(pin.E, pin.N, pin.U, yaw)
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    this.raycaster.setFromCamera(this.toNDC(e), this.camera)
    const hit = this.raycaster.intersectObjects(this.placedUnitPickables, false)[0]
    if (hit) this.removeUnitCb(hit.object.userData.unitId as string)
  }

  private onClick = (e: MouseEvent) => {
    if (!this.meta) return
    // placement is handled by mousedown/move/up (drag-to-orient) for both sides — skip here
    if (this.placing) return
    const ndc = this.toNDC(e)
    this.raycaster.setFromCamera(ndc, this.camera)
    // remove mode: clicking a placed unit deletes it
    if (this.removing) {
      const hit = this.raycaster.intersectObjects(this.placedUnitPickables, false)[0]
      if (hit) this.removeUnitCb(hit.object.userData.unitId as string)
      return
    }
    // placed operator units — click opens info popup anchored to world coord
    const unitHit = this.raycaster.intersectObjects(this.placedUnitPickables, false)[0]
    if (unitHit) {
      const world = unitHit.object.userData.world as WorldCoordinate
      this.pickPlacedUnitCb(unitHit.object.userData.unitId as string,
        { screen: { x: e.clientX, y: e.clientY }, world })
      return
    }
    // enemy markers take priority over boxes
    const th = this.raycaster.intersectObjects(this.threatPickables, false)[0]
    if (th) {
      this.pickThreatCb(th.object.userData.threat as ThreatPosition, { x: e.clientX, y: e.clientY })
      return
    }
    const boxHit = this.raycaster.intersectObjects(this.boxGroup.children, false)[0]
    if (boxHit) {
      const cursor = this.sceneCursor(e, boxHit.point)
      this.pickCb(this.boxById.get(boxHit.object.userData.id) ?? null, cursor)
      return
    }
    const pointHit = this.points ? this.raycaster.intersectObject(this.points, false)[0] : undefined
    this.pickCb(null, pointHit ? this.sceneCursor(e, pointHit.point) : undefined)
  }

  private sceneCursor(e: MouseEvent, point: THREE.Vector3): SceneCursor {
    if (!this.meta) throw new Error('Cannot resolve cursor before scene metadata loads')
    return {
      screen: { x: e.clientX, y: e.clientY },
      world: v2w([point.x, point.y, point.z], this.meta.origin, this.meta.span),
    }
  }
}
