import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { BoundingBox, CloudMeta, ColorMode, LayerKey, ViewshedInfo } from '../lib/types'
import { CLASS_COLORS, TURBO } from '../lib/colors'
import { fetchCloud, fetchViewshed } from '../lib/api'
import { w2v } from '../lib/utils'

// Module-level cache: the 54 MB cloud is fetched at most once per page load,
// surviving React StrictMode double-mounts and component remounts.
let cloudBuf: ArrayBuffer | null = null
let vsFlags: Uint8Array | null = null

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
  private colors: Partial<Record<ColorMode, THREE.BufferAttribute>> = {}
  private boxGroup = new THREE.Group()
  private observerGroup = new THREE.Group()
  private pickCb: (box: BoundingBox | null) => void = () => {}
  private boxById = new Map<string, BoundingBox>()

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x0a0e13)
    this.scene.add(this.boxGroup, this.observerGroup)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 20000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas)
    canvas.addEventListener('click', this.onClick)
    addEventListener('keydown', this.onKey)
    addEventListener('keyup', this.onKey)

    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.apply(this.clock.getDelta())
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  /** Fetch the cloud + viewshed and build the whole scene. Idempotent. */
  async load(meta: CloudMeta, boxes: BoundingBox[], vs: ViewshedInfo | null): Promise<boolean> {
    const [, , sz] = meta.span
    const [sx, sy] = meta.span

    if (!cloudBuf) cloudBuf = await fetchCloud()
    if (vs && !vsFlags) vsFlags = await fetchViewshed()

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
    if (vsFlags) {
      const colVS = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const seen = vsFlags[i]
        colVS[i * 3] = srgb2lin(seen ? 1 : 0.12) // seen → red, dead ground → green
        colVS[i * 3 + 1] = srgb2lin(seen ? 0.18 : 0.72)
        colVS[i * 3 + 2] = srgb2lin(seen ? 0.18 : 0.4)
      }
      this.colors.viewshed = new THREE.BufferAttribute(colVS, 3)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', this.colors.rgb)
    geo.computeBoundingSphere()
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 1.1, vertexColors: true, sizeAttenuation: true })
    )
    this.scene.add(this.points)

    this.buildBoxes(boxes, meta)
    if (vs) this.buildObserver(vs, meta)

    const d = Math.max(sx, sy)
    this.camera.position.set(0, d * 0.55, d * 0.85)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.resize()
    return !!vsFlags
  }

  setColorMode(mode: ColorMode) {
    const attr = this.colors[mode] ?? this.colors.rgb
    if (this.points && attr) {
      this.points.geometry.setAttribute('color', attr)
      attr.needsUpdate = true
    }
  }

  setLayer(key: LayerKey, visible: boolean) {
    if (key === 'points' && this.points) this.points.visible = visible
    if (key === 'boxes') this.boxGroup.visible = visible
    if (key === 'observer') this.observerGroup.visible = visible
  }

  setSelected(id: string | null) {
    this.boxGroup.children.forEach((m) => {
      const mesh = m as THREE.Mesh
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = mesh.userData.id === id ? 0.45 : 0.14
    })
  }

  onPick(cb: (box: BoundingBox | null) => void) {
    this.pickCb = cb
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.canvas.removeEventListener('click', this.onClick)
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
    for (const b of boxes) {
      const [lx, ly, lz] = b.extent
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(lx, lz, ly),
        new THREE.MeshBasicMaterial({
          color: CLASS_COLORS[b.class_label] ?? 0xffffff,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
      const [vx, vy, vz] = w2v(b.center, meta.origin, meta.span)
      mesh.position.set(vx, vy, vz)
      mesh.rotation.y = 2 * Math.atan2(b.rotation[2], b.rotation[3])
      mesh.userData.id = b.id
      this.boxGroup.add(mesh)
      this.boxById.set(b.id, b)
    }
  }

  private buildObserver(vs: ViewshedInfo, meta: CloudMeta) {
    const [vx, vy, vz] = w2v(vs.observer_world, meta.origin, meta.span)
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(6),
      new THREE.MeshBasicMaterial({ color: 0xffe14d })
    )
    marker.position.set(vx, vy, vz)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(vs.params.range_m - 1, vs.params.range_m, 96),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(vx, -meta.span[2] / 2, vz)
    this.observerGroup.add(marker, ring)
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

  private onClick = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = this.raycaster.intersectObjects(this.boxGroup.children, false)[0]
    this.pickCb(hit ? this.boxById.get(hit.object.userData.id) ?? null : null)
  }
}
