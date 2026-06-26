# Data

**The files in this folder are NOT committed** (see `.gitignore`). Get them from
the SE3 mentor and drop them here:

```
data/point_cloud.ply
data/bounding_boxes.json
```

## `point_cloud.ply`

Binary little-endian PLY, single `vertex` element, **3,986,862 points**.

| property | type | meaning |
|----------|------|---------|
| `x`, `y`, `z` | `double` | position in **UTM** (metres). `x`=easting, `y`=northing, `z`=elevation ASL |
| `red`, `green`, `blue` | `uchar` | photographic colour (real texture, *not* class codes) |

No normals, no per-point labels. Georeferenced; ~48.3°N (central Europe).
Scene ≈ **1264 × 775 m**, relief ≈ **32 m** (449.9–482.3 m ASL). ~4 pts/m².

## `bounding_boxes.json`

Array of **58 oriented 3D object boxes** — the semantic layer (man-made objects only).

```jsonc
{
  "id": "0_car",
  "name": "Car",
  "class_label": "car",          // car | container | wall | house | shelter
  "center":   [E, N, U],         // UTM metres (same frame as the cloud)
  "extent":   [L, W, H],         // box size in metres
  "rotation": [0, 0, qz, qw],    // quaternion — yaw about vertical only
  "avg_temperature": 13.4        // thermal/IR signature, °C
}
```

Counts: shelter 19 · house 15 · container 16 · wall 7 · car 1.
Temperature 9.8–25.4 °C (warm objects ⇒ possibly occupied / recently active).
Boxes are in the **same UTM frame** as the cloud — they register directly, no alignment needed.

> Note: terrain, roads and vegetation are **not** labeled. Those are derived from
> the cloud (see roadmap). The boxes are exactly the sightline occluders / cover
> elements Track 1 needs.
