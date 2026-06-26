type V3 = [number, number, number]

// World (UTM E, N, elev) → view space, recentred on the scene and y-up.
export function w2v(p: V3, origin: V3, span: V3): V3 {
  const cx = origin[0] + span[0] / 2
  const cy = origin[1] + span[1] / 2
  const cz = origin[2] + span[2] / 2
  return [p[0] - cx, p[2] - cz, -(p[1] - cy)]
}
