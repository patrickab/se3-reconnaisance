This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where content has been compressed (code blocks are separated by ⋮---- delimiter).

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.github/
  dependabot.yml
data/
  README.md
docs/
  CHALLENGE.md
  DATA.md
  MANEUVER_ANALYSIS.md
  THREAT_LIBRARY.md
src/
  backend/
    scripts/
      inspect_ply.py
      prepare_web.py
      render_rasters.py
    __init__.py
    io.py
    README.md
  frontend/
    public/
      .gitkeep
    index.html
    README.md
  __init__.py
._point_cloud.ply
.gitignore
pyproject.toml
README.md
run.sh
```

# Files

## File: .github/dependabot.yml
````yaml
# .github/dependabot.yml

version: 2
updates:

  # Main rule for your Python dependencies
  - package-ecosystem: "pip"
    directory: "/" # Look for pyproject.toml in the root directory
    schedule:
      interval: "weekly"

    reviewers:
      - "patrickab"

    # Group related updates to reduce PR noise
    groups:
      streamlit-plugins:
        patterns:
          - "streamlit*"
          - "st-copy"
````

## File: data/README.md
````markdown
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
````

## File: docs/DATA.md
````markdown
# Data findings (inspected, not assumed)

What the provided files *actually* contain — verified by parsing them, because
the marketing ("segmented, semantically labeled") and the delivery differ.

## Point cloud — `data/point_cloud.ply`

- Binary little-endian, single `vertex` element, **3,986,862 points**.
- Per point: `double x,y,z` + `uchar red,green,blue`. **No labels, no normals.**
- Colour is real photo texture (25,778 unique colours in a 200k sample) — *not*
  a class palette.
- **Georeferenced UTM, metres.** Origin ≈ E 717039 / N 5355383 (~48.3°N, central
  Europe). `z` = true elevation ASL.
- Extent **1264 × 775 m**, relief **32.5 m** (449.9 → 482.3 m). Density ≈ 4 pts/m²
  (57% of 0.5 m cells occupied) — good for terrain & building massing, marginal
  for fine detail (individual windows / people).
- The scene is a **military training area**: airstrip, road net, barracks rows, a
  MOUT-style village, hangars, treelines, open fields.

## Semantic layer — `data/bounding_boxes.json`

- **58 oriented 3D boxes**, man-made objects only: shelter 19 · house 15 ·
  container 16 · wall 7 · car 1.
- Each: `center` [E,N,U] UTM · `extent` [L,W,H] m · `rotation` yaw quaternion
  `[0,0,qz,qw]` · **`avg_temperature` °C**.
- Temperature 9.8–25.4 °C. Hottest: `34_house` 25.4, `28_house` 21.3,
  `5_container` 19.3 → candidate "occupied / recently active".
- **Registration confirmed**: boxes drop exactly onto the structures in the cloud
  → both share the same UTM frame, no co-registration needed.

## Implications

1. **Track 2 (change detection) is blocked** — only one temporal pass exists.
   Confirm with the mentor whether a second pass is coming; otherwise Track 1 is
   the only viable bet.
2. **No per-point semantics, but the right objects are labeled.** Buildings/walls
   = sightline occluders + hard cover, handed over as cheap geometric primitives
   (ray-test 58 boxes, not 4M points). Terrain + vegetation we derive from the
   cloud (vegetation = concealment).
3. **"True 3D" claim must be calibrated** to surface-accurate multi-level
   visibility (roofs/walls/canopy beat a flat heightmap) — not volumetric.
4. **Georeferenced UTM is a free win**: output real grid references + metric ranges.
5. **Thermal = single-pass activity signal** the geometry alone can't give.

## Reproduce

```bash
uv run python src/backend/scripts/inspect_ply.py        # header + stats
uv run python src/backend/scripts/render_rasters.py     # ortho / DSM / height-above-ground (-> docs/figures/, gitignored)
```
````

## File: docs/MANEUVER_ANALYSIS.md
````markdown
# Maneuver Analysis — Blue (friendly) course of action

> Given the red laydown from [THREAT_LIBRARY.md](THREAT_LIBRARY.md), how should
> friendly forces move through this zone? This is the output an operator acts on:
> *where can I move unseen, where will I die, what must I kill first, do I go.*
> Everything here is computed from the 3D reconstruction + the threat envelopes —
> in real UTM metres, designed to read in **under 10 seconds**.

## The principle: observation gates lethality

Both fire modes collapse to one question — **can the enemy observe this ground?**
- **Direct fire:** a weapon with LOS to you, and you in range → you can be shot now.
- **Indirect fire:** *any* observer with LOS to you, you in range, kill-chain closes (~3 min with a recon UAV) → you can be shelled.

So the spine of the analysis is the **viewshed** — computed from every red sensor —
and weapon ranges layered on top. Build that one primitive well and every output
below falls out of it.

---

## The computed layers (each a raster over the zone)

Inputs: terrain surface + the 58 object boxes (occluders / cover) + derived
vegetation (concealment) + the red `enemy_assets.json`.

1. **Combined enemy observation map** `O(x)` — union of every red sensor's viewshed
   (snipers, tank/IFV optics, ground OPs, recon UAV). "Where am I seen, and by how
   many." The most important layer; it gates everything else.
2. **Direct-fire lethality** `D(x)` — per direct-fire weapon: `viewshed ∩ range[min,max] ∩ arc`, combined. "Where can I be shot directly," with which weapon.
3. **Indirect-fire coverage** `I(x)` — union of indirect range fans, **weighted by `O(x)`** and kill-chain time. Inside artillery range *and* observed = high; in range but unobserved (defilade from all observers) = low. "Where can I be shelled if seen."
4. **Cover** `C(x)` — hard cover from the boxes (walls, containers, houses stop fire) + terrain defilade. "What stops bullets here."
5. **Concealment** `K(x)` — vegetation (derived from the cloud) hides from view but not fire. "What hides me here." *Cover ≠ concealment — kept separate on purpose.*
6. **Traversability** `T(x)` — slope + surface class. "Can I physically move here / how fast."

### Composite risk surface
```
risk(x) = w_o·O(x) + w_d·D(x) + w_i·I(x)·observed(x) − w_c·C(x) − w_k·K(x)
```
Direct fire dominates where it reaches (instant, precise); observation+indirect
dominates the deep area; cover and concealment subtract risk. Weights are tuned to
what the sponsor/operators call "significant" (an open question for the mentor).

---

## Movement: the least-cost approach

Approach routes are **not** an ML prediction — they're terrain-logic optimisation
(like routing around traffic), which is *better* here: deterministic, explainable,
no training data needed. Find the cheapest path from line-of-departure to objective:

```
cost(step) = distance
           + α·exposure_to_observation        ← time spent in O(x)
           + β·direct_fire_lethality           ← D(x) along the step
           + γ·indirect_risk                   ← I(x)
           + δ·traversability_penalty          ← slope / bad surface
           − concealment_credit                ← moving through K(x)
```

The genuinely hard, interesting part is **defining `exposure`** — and it loops
straight back into the viewshed engine. That coupling is where the real
intelligence lives. The route-finder itself (Dijkstra / A* on the cost raster) is a
solved primitive. Output favours **dead ground, defilade, concealed corridors,
and the lee of buildings** — the path a good NCO would pick, with the reasons made explicit.

---

## What the operator gets (the actionable outputs)

1. **Covered approach axis** — the recommended route, drawn on the 3D view, with the % of it that is unseen vs exposed, and *where* the exposed stretches are.
2. **Bound / overwatch plan** — along the route, where to bound cover-to-cover and which friendly **support-by-fire** positions can overwatch each bound (bounding overwatch: the overwatch element must stay within supporting range of the bounding one).
3. **Suppression priority (HVT list)** — rank the red assets by how much of *your* approach they dominate. The tank that observes 60% of your axis outranks the sniper covering a corner. For each: *what to suppress, and the friendly position(s) from which you can engage it while staying concealed* (field-of-fire ∧ concealment for blue — the mirror of the red analysis).
4. **Dead-ground / assembly areas** — terrain hidden from all red observers: where to mass, form up, or treat casualties safely.
5. **Chokepoints** — where viable routes funnel (and where red expects you). Flag to avoid or to seize/clear first.
6. **Obscuration cue** — where a sightline can't be avoided, mark *where smoke* breaks the critical observation so the bound is survivable.
7. **The call** — **GO / NO-GO / GO-WITH-CONDITIONS**, e.g. *"Go: covered axis along the eastern treeline, 85% concealed; suppress the tank at grid …; smoke the 70 m open stretch at grid …; assembly in dead ground behind building 36."*

All of it in **UTM / MGRS grid references and metres** — operators think in grids, and it costs us nothing because the data is georeferenced.

---

## A single-pass bonus: thermal cueing

`avg_temperature` in `bounding_boxes.json` lets us flag **which structures are
warm** (occupied / recently active) — a hint about *where the red assets actually
are* before we even template them. Hot building ⇒ raise its likelihood of hosting
an OP/weapon. This recovers a "live scene intelligence" angle from a single pass.

---

## Maps to our build

| Layer | Source | Status |
|-------|--------|--------|
| terrain surface, slope | point cloud | next |
| occluders / hard cover | the 58 boxes | have |
| concealment (vegetation) | derived from cloud RGB+geometry | next |
| viewshed engine | terrain + boxes | **core to build** |
| `O/D/I` threat maps | viewshed + `enemy_assets.json` | after engine |
| route + COA outputs | cost raster + A* | after maps |

Backend modules to add live in [`src/backend/README.md`](../src/backend/README.md):
`terrain.py → visibility.py → fields.py → routes.py`.

## Honest limits (say these to the jury)

- The cloud is **~4 pts/m², top-down** → rich **2.5D surface**, not volumetric.
  We claim **surface-accurate multi-level visibility** (viewshed over real
  roofs/walls/canopy, which beats a flat bare-earth heightmap) — *not* see-through
  walls or building interiors.
- Engagement envelopes are **doctrinal models**, not ballistics — they bound the
  reasoning, they don't simulate a shell.
- Red positions are **templated/suspected** unless cued (e.g. by thermal); we label
  confidence and never present a guess as a confirmed contact.
- One temporal pass → no change detection; movement of red assets isn't tracked.

## Sources
- [Fire and movement](https://en.wikipedia.org/wiki/Fire_and_movement) · [Bounding overwatch](https://en.wikipedia.org/wiki/Bounding_overwatch) · [Enfilade and defilade / dead ground](https://en.wikipedia.org/wiki/Enfilade_and_defilade)
- [FM 34-130 IPB](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3 IPB (situation template, avenues of approach, COA)](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
- [Russia's reconnaissance-strike kill chain, Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
````

## File: docs/THREAT_LIBRARY.md
````markdown
# Threat Library — Red (OPFOR) asset model

> Scenario context for Track 1. We place a realistic **Russian threat laydown**
> into the reconstructed zone — each asset with its own observation and weapon
> envelope — then compute how friendly (Ukrainian / NATO) forces should maneuver
> against it. This is the **situation-template** step of Intelligence Preparation
> of the Battlefield (IPB, FM 34-130 / ATP 2-01.3): put the enemy where the
> terrain favours them, then reason about it.

Specs below are approximate, vary by variant/ammunition, and are sourced (see
end). They are used as **engagement-envelope parameters**, not exact ballistics —
good enough to drive terrain-grounded tactical reasoning, honest about being a
model.

---

## The one distinction that organises everything: how the kill happens

Every red asset kills you in one of three ways, and the terrain math differs for each:

| Mode | Needs line of sight? | Defeated by | Examples |
|------|----------------------|-------------|----------|
| **Direct fire** | **Yes** — the shooter must see you | dead ground, defilade, cover, breaking LOS | sniper, tank gun, ATGM, IFV autocannon, MG |
| **Indirect fire** | **No** — arcs over terrain | *not* terrain masking; only by denying **observation** (concealment, speed, smoke) and by range | mortar, howitzer, MLRS |
| **Observation / enabling** | **Yes** (it's a sensor) | counter-recon, EW, staying unseen | recon UAV, forward observer, EW |

**The master variable is observation.** Direct fire = *a weapon* sees you and you're in range. Indirect fire = *any observer* sees you, you're in range, and the kill chain closes in time. So the core computed product (see [MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md)) is the **combined enemy observation map** — the union of every red sensor's viewshed — with weapon range envelopes layered on top. Our viewshed engine is the heart of both red threat assessment and blue planning.

---

## Asset cards

Each card gives the real-world numbers and the **model parameters** we drive the
analysis with. `obs` = what it can *see* (sensor); `wpn` = what it can *kill*
(weapon). Ranges in metres.

### Sniper / Designated Marksman — `sniper`
- **Real:** SVD Dragunov 7.62×54 effective ~800 practical, ~1,200–1,300 max; precision rifles (Orsis T-5000) ~1,000–1,500; anti-materiel OSV-96 12.7 mm ~2,000 (defeats vehicles/optics).
- **obs:** optical/thermal, **arc ~ limited (~120° sector)** from a hide, range ≈ weapon range. **wpn:** direct, min ~100, eff ~800, max ~1,300 (AMR ~2,000), arc = sector.
- **Signature:** very low (the hardest to find). **Emplacement here:** upper floors of the tall houses (`36_house` 16 m, `24_house` 9 m) overlooking open approaches; treelines.
- **Threat character:** denies a corridor to dismounts; the viewshed *is* the threat. Defeated by dead ground / breaking LOS.

### Main Battle Tank — `tank`  (T-72 / T-80 / T-90)
- **Real:** 2A46M 125 mm — KE direct fire effective ~2,000–3,000, FCS to ~4,000–5,000; gun-launched ATGM 9M119 Refleks 100–5,000 (penetrates armour to 4 km). Coax 7.62 (~1,000), 12.7 AA MG (~1,500–2,000). Good thermal sights (day/night, multi-km).
- **obs:** thermal+optical, **360°**, range ~4,000. **wpn:** direct, min ~100, eff ~2,500, max ~5,000 (ATGM), **360°** turret.
- **Signature:** high (thermal/acoustic/visual), mobile (tracked). **Emplacement here:** hull-down behind walls/buildings or on roads with fields of fire down the long approach corridors; reverse-slope to ambush.
- **Vulnerabilities:** top-attack, ATGM, defilade; large dead zones close-in and behind masks.

### ATGM team — `atgm`  (Kornet 9M133)
- **Real:** base 5.0–5.5 km; Kornet-M ~8 km; FM-3 HE ~10 km; min ~100 m. Laser beam-rider, direct LOS, anti-armour (also bunkers/buildings).
- **obs:** optical/thermal sight, sector ~360° (repositionable), range ≈ weapon. **wpn:** direct, min ~150, eff ~4,000, max ~5,500 (–10,000), arc = sector.
- **Signature:** low until it fires (then laser/launch signature). **Emplacement here:** flanks/overwatch with long sightlines covering armour avenues; building edges.
- **Threat character:** dominant vs vehicles on any open, observed corridor. Defeated by masking LOS and by suppressing the team.

### Infantry Fighting Vehicle — `ifv`  (BMP-2/3)
- **Real:** 2A42 30 mm — vs light armour ~1,500, vs soft targets ~4,000, air to ~2,000–2,500; plus ATGM (Konkurs/Kornet). Optical/thermal sights.
- **obs:** thermal+optical, 360°, range ~3,000. **wpn:** direct, eff ~2,000, max ~4,000, 360°.
- **Signature:** high, mobile. **Emplacement:** overwatch of approaches, mutual support with tanks; carries dismounts.

### Mortar — `mortar`  (2S12 Sani 120 mm)
- **Real:** max ~7.1 km. High-angle **indirect** — arcs over terrain. Organic to infantry, responsive.
- **obs:** none of its own (needs a forward observer). **wpn:** **indirect**, min ~0.5 km, max ~7,100, **360°**, area effect.
- **Signature:** acoustic on firing; usually in defilade. **Emplacement here:** reverse slope / behind the building mass, unseen.
- **Threat character:** kills you anywhere within 7 km **if an observer sees you** — terrain won't hide you, breaking observation will.

### Towed / SP Howitzer — `howitzer`  (D-30 122 mm; 2S19 Msta 152 mm)
- **Real:** D-30 ~15.3 km (21.9 km RAP); 2S19 Msta-S ~24–30 km (40 km RAP / Krasnopol precision). Indirect.
- **obs:** none of its own. **wpn:** indirect, max 15,000–30,000+, 360° (or wide arc), area / precision.
- **Threat character:** the whole zone is inside its fan. Lethality gated entirely by **observation + kill-chain time**, not terrain.

### MLRS — `mlrs`  (BM-21 Grad 122 mm; BM-30 Smerch 300 mm)
- **Real:** Grad ~20 km (–40 km), 40-rocket saturation; Smerch ~70–90 km (–120 km). Indirect, area.
- **wpn:** indirect, max 20,000–90,000, area saturation. **Threat character:** punishes massing / assembly in the open; argues for dispersion and speed.

### Reconnaissance UAV — `uav_recon`  (Orlan-10)  ← the kill-chain enabler
- **Real:** loiters 1,000–1,500 m altitude, optical/IR/EW sensors, ~18 h endurance; **cues artillery to fire within ~3 min** of spotting a target (vs ~20 min without). EW variant jams GPS/comms; jamming-resistant.
- **obs:** **wide-area, top-down**, effectively sees most of the open zone; this is what makes *every indirect weapon* lethal. **wpn:** none (it spots; the guns shoot).
- **Threat character:** **this node turns "in range" into "in danger."** Suppressing/defeating observation (this drone + ground OPs) is the single highest-leverage blue action. Ties directly to SE3's **GNSS-denied** context — both sides fight blind/jammed.

### Electronic Warfare — `ew`  (optional)
- Jams GPS/comms — degrades our own recon drones and navigation. Note it as a constraint on the *blue* ISR that produced this 3D map, not a direct-fire threat.

---

## Data schema — `data/enemy_assets.json` (proposed)

Same UTM frame as the cloud and `bounding_boxes.json`, so red assets drop straight
into the viewer and the analysis. Drives both the engagement envelopes and the
viewsheds.

```jsonc
{
  "id": "red_01_tank",
  "class_label": "tank",            // sniper|tank|atgm|ifv|mortar|howitzer|mlrs|uav_recon|ew
  "side": "OPFOR",
  "position": [E, N, U],            // UTM metres; U includes sensor/muzzle height AGL
  "facing_deg": 135,                // primary orientation (matters for arc-limited assets)
  "obs": { "sensor": "thermal+optical", "range_m": 4000, "arc_deg": 360, "height_agl_m": 2.5 },
  "wpn": { "fire_type": "direct",   // direct | indirect
           "system": "2A46M 125mm + 9M119",
           "min_range_m": 100, "eff_range_m": 2500, "max_range_m": 5000, "arc_deg": 360 },
  "signature": { "thermal": "high", "acoustic": "high", "visual": "high" },
  "mobility": "tracked",
  "confidence": "suspected"         // confirmed | suspected | templated
}
```

## Where red would actually sit on THIS terrain (auto-placement logic)

Don't scatter assets randomly — emplace them where doctrine + terrain say they'd
be, reusing the layers we already compute:
- **Snipers / OPs** → highest-viewshed points (tall buildings, ridge) that dominate the open approaches.
- **Tanks / ATGM** → positions with long fields of fire down the armour avenues, ideally hull-down behind walls/buildings (use the 58 boxes as hull-down masks).
- **Mortars / artillery** → **reverse-slope / defilade** behind the building mass and the ridge — unseen, indirect.
- **Recon UAV** → overhead, near-global observation of open ground.

This makes the red laydown defensible to a jury ("you placed them where I would")
and lets us generate **enemy most-likely / most-dangerous COAs** automatically.

---

## Sources
- [T-90 / 2A46M & 9M119 Refleks (Wikipedia)](https://en.wikipedia.org/wiki/T-90) · [9M119 Svir/Refleks](https://en.wikipedia.org/wiki/9M119_Svir/Refleks) · [T-90 (GlobalSecurity)](https://www.globalsecurity.org/military/world/russia/t-90.htm)
- [SVD / sniper ranges (24/7 Wall St.)](https://247wallst.com/special-report/2024/04/11/the-russian-militarys-longest-range-firearms/) · [Orsis T-5000](https://247wallst.com/military/2025/10/17/russian-special-forces-add-the-orsis-t-5000-rifle-for-longer-range-operations/)
- [9M133 Kornet (Wikipedia)](https://en.wikipedia.org/wiki/9M133_Kornet) · [Kornet-M](https://en.wikipedia.org/wiki/9M133M_Kornet-M)
- [BMP-2 / 2A42 30 mm (Wikipedia)](https://en.wikipedia.org/wiki/Shipunov_2A42)
- [D-30 122 mm](https://en.wikipedia.org/wiki/122_mm_howitzer_2A18_(D-30)) · [2S19 Msta-S](https://en.wikipedia.org/wiki/2S19_Msta-S) · [BM-21 Grad](https://en.wikipedia.org/wiki/BM-21_Grad) · [BM-30 Smerch](https://en.wikipedia.org/wiki/BM-30_Smerch) · [2S12 Sani](https://en.wikipedia.org/wiki/2S12_Sani)
- [Orlan-10 (Wikipedia)](https://en.wikipedia.org/wiki/STC_Orlan-10) · [Russia's kill chain in Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
- [FM 34-130 Intelligence Preparation of the Battlefield](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
````

## File: src/backend/scripts/inspect_ply.py
````python
"""Print structure and statistics of the point cloud — sanity check the data.

    uv run python src/backend/scripts/inspect_ply.py [path/to/cloud.ply]
"""
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
⋮----
def main() -> None
⋮----
path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "point_cloud.ply"
v = read_ply(path)
⋮----
a = np.asarray(v[ax])
⋮----
n = v.shape[0]
idx = np.random.default_rng(0).choice(n, size=min(200_000, n), replace=False)
⋮----
uniq = np.unique((r << 16) | (g << 8) | b).size
⋮----
z = np.asarray(v["z"])
pct = np.percentile(z, [0, 1, 5, 50, 95, 99, 100]).round(2)
````

## File: src/backend/scripts/prepare_web.py
````python
"""Pack the point cloud for the three.js viewer.

Voxel-downsamples the ~4M-point cloud for smooth rendering, recenters to a local
origin (UTM values exceed float32 precision, so the browser must use a local
frame), and writes a compact binary + metadata into the frontend's public dir.
The bounding boxes are copied across unchanged.

    uv run python src/backend/scripts/prepare_web.py [--voxel 0.3] [--max-points 1400000]
"""
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
PUBLIC = ROOT / "src" / "frontend" / "public"
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Pack the point cloud for the web viewer")
⋮----
args = ap.parse_args()
⋮----
v = read_ply(args.ply)
⋮----
# one point per occupied voxel -> uniform-looking downsample
vi = ((x - ox) / args.voxel).astype(np.uint64)
vj = ((y - oy) / args.voxel).astype(np.uint64)
vk = ((z - oz) / args.voxel).astype(np.uint64)
⋮----
sel = np.sort(np.random.default_rng(0).choice(sel, args.max_points, replace=False))
⋮----
pos = np.empty((sel.size, 3), np.float32)
⋮----
col = np.empty((sel.size, 3), np.uint8)
⋮----
meta = {
````

## File: src/backend/scripts/render_rasters.py
````python
"""Rasterize the cloud to 2D analysis layers (ortho / DSM / height-above-ground).

Quick top-down views for understanding the scene and debugging. Output PNGs go to
``docs/figures/`` (gitignored — they are derived imagery of the data).

    uv run python src/backend/scripts/render_rasters.py [--res 0.5]
"""
⋮----
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
⋮----
ROOT = Path(__file__).resolve().parents[3]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
OUT = ROOT / "docs" / "figures"
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Rasterize the cloud to 2D layers")
⋮----
args = ap.parse_args()
⋮----
v = read_ply(args.ply)
⋮----
w = int(np.ceil((x.max() - x0) / args.res))
h = int(np.ceil((y.max() - y0) / args.res))
ix = np.clip(((x - x0) / args.res).astype(np.int64), 0, w - 1)
iy = h - 1 - np.clip(((y - y0) / args.res).astype(np.int64), 0, h - 1)  # north up
cell = iy * w + ix
order = np.argsort(z, kind="stable")  # last write per cell = highest point
⋮----
# top-down ortho (colour of highest point per cell)
rgb = np.zeros((w * h, 3), np.uint8)
⋮----
# digital surface model (max height per cell)
dsm = np.full(w * h, np.nan)
⋮----
def _save(img: np.ndarray, title: str, cmap: str, path: Path) -> None
⋮----
im = ax.imshow(img, cmap=cmap)
````

## File: src/backend/__init__.py
````python

````

## File: src/backend/io.py
````python
"""PLY reader for the SE3 reconnaissance point cloud.

Supports binary-little-endian PLY with a single ``vertex`` element (the format
SE3 ships). Returns a numpy structured array memory-mapped from disk, so even
the ~4M-point cloud loads instantly without copying it into RAM.
"""
⋮----
# PLY type name -> numpy type code
_PLY_DTYPE: dict[str, str] = {
⋮----
def read_ply(path: str | Path) -> np.ndarray
⋮----
"""Memory-map a binary-little-endian PLY and return its vertex array.

    Access columns by name, e.g. ``v["x"]``, ``v["red"]``. The dtype is built
    from the header, so extra properties (normals, labels) are picked up
    automatically if SE3 add them later.
    """
path = Path(path)
⋮----
raw = fh.read(8192)
⋮----
header_end = raw.index(b"\n", raw.index(b"end_header")) + 1
fields: list[tuple[str, str]] = []
count = 0
⋮----
parts = line.split()
⋮----
count = int(parts[2])
⋮----
dtype = np.dtype(fields)
````

## File: src/backend/README.md
````markdown
# Backend

Python data IO, processing, and (incoming) tactical-analysis code.

- `io.py` — zero-copy PLY reader (`read_ply` → numpy structured memmap).
- `scripts/` — runnable tools:
  - `inspect_ply.py` — print header + statistics (sanity-check the data)
  - `prepare_web.py` — downsample + pack the cloud for the viewer
  - `render_rasters.py` — top-down ortho / DSM layers (→ `docs/figures/`)

## Setup

```bash
uv sync                  # installs numpy, matplotlib, pillow
uv run python src/backend/scripts/inspect_ply.py
```

## Roadmap (tactical layer goes here)

Track-1 analysis modules to add next, all sharing one visibility primitive:

- `terrain.py` — derive ground surface + vegetation mask from the cloud
- `visibility.py` — viewshed / line-of-sight on terrain + the 58 object occluders
- `fields.py` — field-of-fire score, exposure / concealment map, dead ground
- `routes.py` — least-cost approach paths (slope + traversability + exposure)

Keep outputs operator-actionable: a ranked answer + a clear visual, in UTM grid
references, in < 10 s.
````

## File: src/frontend/public/.gitkeep
````

````

## File: src/frontend/index.html
````html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SE3 Tactical — Point Cloud + Objects</title>
<style>
  html,body{margin:0;height:100%;background:#0b0e13;color:#cfd8e3;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;overflow:hidden}
  #c{position:fixed;inset:0;display:block}
  .panel{position:fixed;background:rgba(10,14,20,.85);border:1px solid #243042;border-radius:10px;padding:11px 13px;backdrop-filter:blur(6px)}
  #hud{top:12px;left:12px;min-width:232px}
  #hud h1{margin:0 0 8px;font-size:12px;letter-spacing:.4px;color:#7fd1ff;font-weight:600}
  .row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0}
  .row label{color:#9fb0c3}
  input[type=range]{width:118px}
  button{background:#16202e;color:#cfe3ff;border:1px solid #2c3a4f;border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit}
  button:hover{background:#1d2a3c}
  .seg button{margin-right:4px}
  .seg button.on{background:#1f6feb;border-color:#1f6feb;color:#fff}
  #stat{margin-top:8px;color:#6b7c91;font-size:11px;border-top:1px solid #243042;padding-top:8px}
  #legend{top:12px;right:12px;min-width:170px}
  #legend h2{margin:0 0 7px;font-size:11px;color:#9fb0c3;font-weight:600;letter-spacing:.3px}
  .lg{display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;user-select:none}
  .sw{width:12px;height:12px;border-radius:3px;flex:0 0 auto;border:1px solid #00000055}
  .lg.off{opacity:.35}
  .lg .ct{margin-left:auto;color:#6b7c91}
  #info{bottom:12px;right:12px;min-width:210px;display:none}
  #info h3{margin:0 0 6px;font-size:12px;color:#7fd1ff}
  #info table{width:100%;border-collapse:collapse}
  #info td{padding:2px 0;color:#9fb0c3}
  #info td.v{color:#dfe9f4;text-align:right}
  #help{position:fixed;bottom:12px;left:12px;color:#5d6e82;font-size:11px}
  #load{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;color:#7fd1ff}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="load">loading scene…</div>

<div id="hud" class="panel" style="display:none">
  <h1>SE3 ZONE · 1264 × 775 m · 1:1</h1>
  <div class="row"><label>points</label>
    <span class="seg"><button id="bRGB" class="on">RGB</button><button id="bHGT">height</button></span></div>
  <div class="row"><label>objects</label>
    <span class="seg"><button id="bCLS" class="on">class</button><button id="bTHM">thermal</button></span></div>
  <div class="row"><label>point size</label><input id="psz" type="range" min="0.3" max="4" step="0.1" value="1.2"></div>
  <div class="row"><label>box fill</label><input id="opf" type="range" min="0" max="0.5" step="0.02" value="0.14"></div>
  <div class="row"><label><input type="checkbox" id="cEdges" checked> edges</label>
    <label><input type="checkbox" id="cPts" checked> cloud</label></div>
  <div class="row"><button id="top">top-down</button><button id="obl">oblique</button><button id="reset">reset</button></div>
  <div id="stat"></div>
</div>

<div id="legend" class="panel" style="display:none"><h2>OBJECTS · 58</h2><div id="lglist"></div>
  <div id="thermbar" style="display:none;margin-top:8px;font-size:10px;color:#6b7c91">thermal 9.8 → 25.4 °C</div></div>

<div id="info" class="panel"><h3 id="iName">—</h3><table id="iTab"></table></div>

<div id="help">drag = orbit · scroll = zoom · right-drag = pan · click a box = details</div>

<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
}}
</script>
<script type="module">
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// ---- load data ----
const meta = await (await fetch('public/meta.json')).json();
const boxes = await (await fetch('public/bounding_boxes.json')).json();
const N = meta.n, [sx,sy,sz] = meta.span, [ox,oy,oz] = meta.origin;
const buf = await (await fetch('public/cloud.bin')).arrayBuffer();
const pos = new Float32Array(buf, 0, N*3);
const rgb = new Uint8Array(buf, N*3*4, N*3);

// scene centre in UTM (so geometry sits around the origin, TRUE 1:1 scale)
const ESC = ox + sx/2, NSC = oy + sy/2, USC = oz + sz/2;
const W2V = (E,Nn,U)=>[E-ESC, U-USC, -(Nn-NSC)];   // east->X, up->Y, north->-Z

// ---- point cloud (no vertical exaggeration) ----
const positions = new Float32Array(N*3); const heights=new Float32Array(N);
let zmin=1e9,zmax=-1e9;
for(let i=0;i<N;i++){
  const e=pos[i*3],n=pos[i*3+1],u=pos[i*3+2];
  positions[i*3]=e-(sx/2); positions[i*3+1]=u-(sz/2); positions[i*3+2]=-(n-(sy/2));
  heights[i]=u; if(u<zmin)zmin=u; if(u>zmax)zmax=u;
}
const colRGB=new Float32Array(N*3); for(let i=0;i<N*3;i++) colRGB[i]=rgb[i]/255;
function turbo(t){t=Math.min(1,Math.max(0,t));
  const r=Math.max(0,Math.min(1,(34.61+t*(1172.33-t*(10793.56-t*(33300.12-t*(38394.49-t*14825.05)))))/255));
  const g=Math.max(0,Math.min(1,(23.31+t*(557.33+t*(1225.33-t*(3574.96-t*(1073.77+t*707.56)))))/255));
  const b=Math.max(0,Math.min(1,(27.2+t*(3211.1-t*(15327.97-t*(27814-t*(22569.18-t*6838.66)))))/255));
  return [r,g,b];}
const colHGT=new Float32Array(N*3);
for(let i=0;i<N;i++){const c=turbo((heights[i]-zmin)/(zmax-zmin));colHGT[i*3]=c[0];colHGT[i*3+1]=c[1];colHGT[i*3+2]=c[2];}

const geo=new THREE.BufferGeometry();
geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
geo.setAttribute('color',new THREE.BufferAttribute(colRGB.slice(),3));

const renderer=new THREE.WebGLRenderer({canvas:c,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b0e13);
const cam=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.5,12000);
const mat=new THREE.PointsMaterial({size:1.2,vertexColors:true,sizeAttenuation:true});
const cloud=new THREE.Points(geo,mat); scene.add(cloud);
const grid=new THREE.GridHelper(Math.max(sx,sy),Math.round(Math.max(sx,sy)/100),0x223044,0x141d29);
grid.position.y=-sz/2; scene.add(grid);
// north arrow (north = -Z)
scene.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(-sx/2+30,-sz/2,sy/2-30),90,0x4488ff,28,16));

// ---- objects (oriented boxes, true scale) ----
const CLASS_COL={car:0xff4d4d,container:0xffa033,wall:0xffe14d,house:0x4dd2ff,shelter:0x6bff8f};
const temps=boxes.map(b=>b.avg_temperature); const tmin=Math.min(...temps),tmax=Math.max(...temps);
const thermCol=t=>{const c=turbo((t-tmin)/(tmax-tmin));return (Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255);};
const boxGroup=new THREE.Group(); scene.add(boxGroup);
const fills=[]; const visClass={};
for(const b of boxes){
  const [E,Nn,U]=b.center, [lx,ly,lz]=b.extent;
  const qz=b.rotation[2], qw=b.rotation[3]; const yaw=2*Math.atan2(qz,qw);
  const g=new THREE.BoxGeometry(lx,lz,ly);         // X=E-len, Y=up-height, Z=N-width
  const col=CLASS_COL[b.class_label]??0xffffff;
  const fm=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.14,depthWrite:false,side:THREE.DoubleSide});
  const m=new THREE.Mesh(g,fm);
  const [vx,vy,vz]=W2V(E,Nn,U); m.position.set(vx,vy,vz); m.rotation.y=yaw;
  const ed=new THREE.LineSegments(new THREE.EdgesGeometry(g),new THREE.LineBasicMaterial({color:col}));
  m.add(ed); m.userData={box:b,baseCol:col,edge:ed};
  boxGroup.add(m); fills.push(m);
}

// ---- camera / controls ----
const ctrl=new OrbitControls(cam,renderer.domElement); ctrl.enableDamping=true; ctrl.dampingFactor=0.08;
const D=Math.max(sx,sy);
const obl=()=>{cam.position.set(0,D*0.55,D*0.85);ctrl.target.set(0,0,0);ctrl.update();};
const top=()=>{cam.position.set(0,D*1.15,0.01);ctrl.target.set(0,0,0);ctrl.update();};
obl();

// ---- UI ----
const $=id=>document.getElementById(id);
$('psz').oninput=e=>mat.size=+e.target.value;
$('opf').oninput=e=>fills.forEach(m=>m.material.opacity=+e.target.value);
$('cEdges').onchange=e=>fills.forEach(m=>m.userData.edge.visible=e.target.checked);
$('cPts').onchange=e=>cloud.visible=e.target.checked;
$('top').onclick=top; $('obl').onclick=obl; $('reset').onclick=obl;
function setPtCol(a,w){geo.setAttribute('color',new THREE.BufferAttribute(a,3));geo.attributes.color.needsUpdate=true;
  $('bRGB').classList.toggle('on',w==='rgb');$('bHGT').classList.toggle('on',w==='hgt');}
$('bRGB').onclick=()=>setPtCol(colRGB.slice(),'rgb'); $('bHGT').onclick=()=>setPtCol(colHGT.slice(),'hgt');
function boxColorMode(mode){
  $('bCLS').classList.toggle('on',mode==='cls');$('bTHM').classList.toggle('on',mode==='thm');
  $('thermbar').style.display=mode==='thm'?'block':'none';
  fills.forEach(m=>{const b=m.userData.box;const col=mode==='thm'?thermCol(b.avg_temperature):m.userData.baseCol;
    m.material.color.setHex(col);m.userData.edge.material.color.setHex(col);});
}
$('bCLS').onclick=()=>boxColorMode('cls'); $('bTHM').onclick=()=>boxColorMode('thm');

// legend with per-class toggle
const counts={}; boxes.forEach(b=>counts[b.class_label]=(counts[b.class_label]||0)+1);
const order=['shelter','house','container','wall','car'];
$('lglist').innerHTML=order.map(k=>`<div class="lg" data-k="${k}"><span class="sw" style="background:#${CLASS_COL[k].toString(16).padStart(6,'0')}"></span>${k}<span class="ct">${counts[k]||0}</span></div>`).join('');
order.forEach(k=>visClass[k]=true);
document.querySelectorAll('.lg').forEach(el=>el.onclick=()=>{const k=el.dataset.k;visClass[k]=!visClass[k];
  el.classList.toggle('off',!visClass[k]);
  fills.forEach(m=>{if(m.userData.box.class_label===k)m.visible=visClass[k];});});

// click to inspect
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let sel=null;
renderer.domElement.addEventListener('click',ev=>{
  ndc.x=(ev.clientX/innerWidth)*2-1; ndc.y=-(ev.clientY/innerHeight)*2+1;
  ray.setFromCamera(ndc,cam);
  const hit=ray.intersectObjects(fills,false);
  if(sel){sel.userData.edge.material.color.setHex(curHex(sel));sel.material.opacity=+$('opf').value;sel=null;}
  if(hit.length){sel=hit[0].object; sel.userData.edge.material.color.setHex(0xffffff); sel.material.opacity=Math.max(0.3,+$('opf').value);
    const b=sel.userData.box;
    $('iName').textContent=b.name+'  ('+b.id+')';
    $('iTab').innerHTML=
      `<tr><td>class</td><td class="v">${b.class_label}</td></tr>`+
      `<tr><td>size L×W×H</td><td class="v">${b.extent.map(x=>x.toFixed(1)).join(' × ')} m</td></tr>`+
      `<tr><td>temperature</td><td class="v">${b.avg_temperature.toFixed(1)} °C</td></tr>`+
      `<tr><td>yaw</td><td class="v">${(2*Math.atan2(b.rotation[2],b.rotation[3])*180/Math.PI).toFixed(0)}°</td></tr>`+
      `<tr><td>UTM E</td><td class="v">${b.center[0].toFixed(1)}</td></tr>`+
      `<tr><td>UTM N</td><td class="v">${b.center[1].toFixed(1)}</td></tr>`+
      `<tr><td>elev</td><td class="v">${b.center[2].toFixed(1)} m</td></tr>`;
    $('info').style.display='block';
  } else { $('info').style.display='none'; }
});
function curHex(m){const b=m.userData.box;return $('bTHM').classList.contains('on')?thermCol(b.avg_temperature):m.userData.baseCol;}

$('load').style.display='none'; $('hud').style.display='block'; $('legend').style.display='block';
$('stat').innerHTML=`pts ${N.toLocaleString()} · objects 58<br>UTM origin ${ox.toFixed(0)} E ${oy.toFixed(0)} N<br>relief ${sz.toFixed(1)} m · grid 100 m · N→arrow`;

addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
(function loop(){requestAnimationFrame(loop);ctrl.update();renderer.render(scene,cam);})();
</script>
</body>
</html>
````

## File: src/frontend/README.md
````markdown
# Frontend — 3D viewer

Interactive viewer for the point cloud + semantic object boxes. Static
`index.html` (three.js via CDN) — no build step.

## Run

```bash
# from repo root: build assets, then serve
./run.sh prep            # writes public/cloud.bin, meta.json, bounding_boxes.json
./run.sh serve           # http://localhost:8011

# or directly:
cd src/frontend && python3 -m http.server 8011
```

`public/` is generated (gitignored). It must exist before serving — run
`./run.sh prep` after dropping the data into `data/`.

## Controls

- **drag** orbit · **scroll** zoom · **right-drag** pan · **click a box** → details
- **points:** RGB / height-coloured · **objects:** colour by class / by thermal
- per-class show/hide (legend), point size, box-fill opacity, edges/cloud toggles
- true 1:1 scale (no vertical exaggeration), 100 m grid, north arrow

## Notes

- Coordinates are recentered to a local origin in `meta.json` (UTM doubles
  exceed float32 precision; the browser works in metres from that origin).
- Frame mapping: east → X, elevation → Y (up), north → −Z.
- three.js is loaded from a CDN, so the browser needs internet on first load.
````

## File: src/__init__.py
````python

````

## File: .gitignore
````
# ---- provided data (large / sensitive — get from the SE3 mentor, never commit) ----
data/*.ply
data/*.json
data/*.pcd
data/*.las
data/*.laz
data/*.bag
data/**/*.ply
data/**/*.json

# ---- generated web assets (rebuild: ./run.sh prep) ----
src/frontend/public/*
!src/frontend/public/.gitkeep

# ---- rendered figures / screenshots (derived from the data — keep out of git) ----
docs/figures/
*.png
*.jpg

# ---- python / uv ----
.venv/
venv/
__pycache__/
*.pyc
.ruff_cache/
.pytest_cache/
*.egg-info/
build/
dist/
uv.lock

# ---- tooling / editor / os ----
.claude/
.playwright-mcp/
.DS_Store
__MACOSX/
.vscode/
.idea/
````

## File: docs/CHALLENGE.md
````markdown
# Challenge — SE3 Labs Tactical AI (EDTH Munich)

A 3D reconstruction of a battlefield zone contains every answer an operator
needs — but can't surface them yet. Build the AI layer that extracts it.

SE3 Labs (Munich spatial-AI, TUM / Cremers lineage; product **SpatialGPT**) turn
live drone video into semantic 3D maps. The geometry is their moat; the
**tactical interpretation on top of it** is the value they don't have yet. This
is automated **Intelligence Preparation of the Battlefield (IPB)** — the terrain
analysis a trained officer does, in seconds, on a live 3D model.

## Two tracks (pick one / combine)

**Track 1 — Tactical Position Intelligence.** Where is the enemy likely to
approach from? Which position gives the best field of fire while staying
concealed? Where are the chokepoints, the dead ground, the key terrain? What
does the enemy see from that building, and where am I exposed?

> Insight: almost every Track-1 question reduces to **"what can be seen from
> where?"** — build the visibility/viewshed engine and the rest follow.
> *Cover* (stops bullets: walls, containers) ≠ *concealment* (hides only:
> vegetation). Approach routes = least-cost paths where cost = slope +
> traversability + **exposure to overwatch** (which loops back into visibility).

**Track 2 — Live Scene Intelligence.** Two passes hours apart: find what changed
and ignore what didn't. Real change is **geometry** (vehicle moved, earth dug);
noise is **appearance** (shadow, sway, lighting). *Requires a second pass — see
DATA.md; we currently have one.*

## Judging (EDTH)

1. Real problem? 2. Effective? 3. Original? 4. Deployable / mass-manufacturable?
5. Progress & drive **during** the event. → A working live demo beats slides; an
honest "here's where it breaks" beats over-claiming. Output must be
**operator-actionable in < 10 seconds**.

## Our direction

Lead with **Track 1**, built on one rigorous primitive: a viewshed / field-of-fire
engine on the true 3D surface (terrain from the cloud + the 58 object boxes as
occluders), in real UTM metres, with grid-reference output. Honest claim:
**surface-accurate multi-level visibility** that beats a flat bare-earth
heightmap — *not* volumetric X-ray 3D (the data is a ~4 pts/m² top-down surface).

Bonus single-pass intelligence we *can* do now: flag **thermal anomalies**
(occupied / recently-active structures) from `avg_temperature`.

The full Track-1 concept — placing a realistic Russian threat laydown and
computing the friendly course of action against it — is in
[THREAT_LIBRARY.md](THREAT_LIBRARY.md) (Red assets) and
[MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md) (Blue movement).

Open questions for the mentor; the two that gate everything: *is there a second
pass?* and *what does a "good" < 10 s output look like to you?*
````

## File: pyproject.toml
````toml
[project]
name = "se3-reconnaissance"
version = "0.1.0"
description = "Tactical AI layer on SE3's 3D battlefield reconstruction (EDTH Munich)"
requires-python = ">=3.12"
dependencies = [
    "numpy>=2.0",
    "matplotlib>=3.8",
    "pillow>=10.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]

[tool.hatch.metadata]
allow-direct-references = true

[tool.ruff]
target-version = "py312"
respect-gitignore = true
line-length = 135

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "F",   # pyflakes
  "I",   # isort
  "B",   # bugbear
  "C4",  # comprehensions
  "TCH", # type-checking hygiene
  "SIM", # simplify
  "ANN", # type hints
  "ARG", # unused arguments
  "RUF"  # Ruff-native rules
]
ignore = [
  "RUF100",
  "B904"
]

[tool.ruff.lint.isort]
force-sort-within-sections = true
section-order = ["standard-library", "third-party", "first-party", "local-folder"]

# Enables Ruff formatter with default options (Black-compatible)
[tool.ruff.format]
````

## File: README.md
````markdown
# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction: turn labeled geometry into the
> judgments an operator needs — *where is the enemy likely to approach, where do
> I have field of fire, where am I exposed* — fast and legible.

Docs:
- [`docs/CHALLENGE.md`](docs/CHALLENGE.md) — the challenge brief & our direction
- [`docs/DATA.md`](docs/DATA.md) — exactly what's in the dataset (inspected, not assumed)
- [`docs/THREAT_LIBRARY.md`](docs/THREAT_LIBRARY.md) — Red (OPFOR) asset model: per-system observation + weapon envelopes
- [`docs/MANEUVER_ANALYSIS.md`](docs/MANEUVER_ANALYSIS.md) — Blue course of action: threat maps, covered approach, suppression priority, go/no-go

## Repo layout

```
.
├── data/                 # provided inputs — gitignored (get from the SE3 mentor)
│   ├── point_cloud.ply   #   ~4M-point cloud, XYZ (UTM, metres) + RGB
│   └── bounding_boxes.json#   58 oriented object boxes + thermal signature
├── src/
│   ├── backend/          # Python: data IO + processing + (soon) tactical analysis
│   │   ├── io.py         #   PLY reader (memmap, zero-copy)
│   │   └── scripts/      #   runnable tools (inspect / prepare web / render)
│   └── frontend/         # interactive 3D viewer (three.js, static)
│       ├── index.html
│       └── public/       #   generated assets — gitignored (./run.sh prep)
├── docs/                 # challenge brief + data findings
├── pyproject.toml        # uv / hatchling project (ruff configured)
└── run.sh                # ./run.sh prep | serve
```

## Quickstart

```bash
# 1. install python deps (uv)
uv sync

# 2. put the provided files in data/  (not in git)
#    data/point_cloud.ply
#    data/bounding_boxes.json

# 3. build the web viewer assets from the cloud
./run.sh prep            # downsample + pack -> src/frontend/public/

# 4. serve the 3D viewer
./run.sh serve           # http://localhost:8011
```

Then open <http://localhost:8011>. Inspect the raw cloud any time with:

```bash
uv run python src/backend/scripts/inspect_ply.py
```

## The viewer

True 1:1 scale (no vertical exaggeration). Point cloud (RGB / height-coloured)
with all 58 oriented object boxes overlaid — colour by **class** or by
**thermal** signature, per-class show/hide, click any box for its
dimensions / temperature / UTM position. North arrow + 100 m grid for scale.

## Status / roadmap

We model a realistic **Russian threat laydown** and compute how friendly forces
maneuver against it. The spine is one primitive — the **viewshed** — because
observation gates lethality (direct fire: a weapon sees you; indirect fire: an
observer sees you). See the two tactical docs above.

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [x] Tactical concept: threat library (Red) + maneuver analysis (Blue)
- [ ] Derived terrain surface + vegetation layer from the cloud (cover vs concealment)
- [ ] **Viewshed / line-of-sight engine** (terrain + the 58 box occluders) — core
- [ ] `data/enemy_assets.json` schema + place Red assets in the viewer
- [ ] Threat maps: combined observation `O`, direct-fire `D`, indirect `I`
- [ ] Approach-route cost surface → covered axis, bounds, chokepoints, dead ground
- [ ] Suppression priority (HVT) + go/no-go callout, in MGRS, < 10 s
- [ ] Enemy-perspective viewshed (drop a pin → what they see & threaten)

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh prep` after you drop the data in.
````

## File: run.sh
````bash
#!/bin/sh
# Dev helper.
#   ./run.sh prep    build viewer assets from data/ -> src/frontend/public/
#   ./run.sh serve   serve the 3D viewer at http://localhost:8011  (default)
set -e
cd "$(dirname "$0")"

case "${1:-serve}" in
  prep)
    shift
    uv run python src/backend/scripts/prepare_web.py "$@"
    ;;
  serve)
    echo "viewer -> http://localhost:8011  (Ctrl-C to stop)"
    cd src/frontend && python3 -m http.server 8011
    ;;
  *)
    echo "usage: ./run.sh [prep|serve]" >&2
    exit 1
    ;;
esac
````
