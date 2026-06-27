// Object class → fill colour (tactical palette lives in tailwind.config.js).
export const CLASS_COLORS: Record<string, number> = {
  car: 0xff5a5f,
  container: 0xffb000,
  wall: 0xe6dc4f,
  house: 0x42c8ff,
  shelter: 0x5ee27a,
}

// Google Turbo colormap, t in [0,1] → [r,g,b] in [0,1].
export const TURBO = (t: number): [number, number, number] => {
  t = Math.max(0, Math.min(1, t))
  const r = (34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05))))) / 255
  const g = (23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56))))) / 255
  const b = (27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66))))) / 255
  const c = (x: number) => Math.max(0, Math.min(1, x))
  return [c(r), c(g), c(b)]
}
