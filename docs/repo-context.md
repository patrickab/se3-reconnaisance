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
  ANALYSIS_LAYER.md
  architecture.md
  challange.md
  conventions.md
  current-focus.md
  data.md
  MANEUVER_ANALYSIS.md
  module-map.md
  THREAT_LIBRARY.md
src/
  backend/
    scripts/
      inspect_ply.py
    __init__.py
    app.py
    fields.py
    io.py
    README.md
    terrain.py
    threat_template.py
    units.py
    visibility.py
  frontend/
    public/
      assets/
        apc.glb
        assault.glb
        at_team.glb
        atgm_team.glb
        ifv.glb
        mortar.glb
        sniper.glb
        tank.glb
      .gitkeep
    src/
      components/
        AnalyzingSpinner.tsx
        DangerAlert.tsx
        FriendlyPanel.tsx
        Hud.tsx
        InfoPanelPopup.tsx
        ObjectPopup.tsx
        PlacedUnitPopup.tsx
        SceneCanvas.tsx
        Sidebar.tsx
        ThreatPanel.tsx
        ThreatPopup.tsx
      engine/
        Viewer.ts
      lib/
        api.ts
        colors.ts
        store.ts
        types.ts
        utils.ts
      App.tsx
      index.css
      main.tsx
    index.html
    package.json
    postcss.config.js
    README.md
    tailwind.config.js
    tsconfig.json
    vite.config.ts
  __init__.py
  config.json
.gitignore
CLAUDE.md
pyproject.toml
README.md
run.sh
```

# Files

## File: CLAUDE.md
````markdown
# CLAUDE.md — SE3 Reconnaissance (EDTH Munich)

Tactical-AI layer on SE3 Labs' georeferenced 3D battlefield reconstruction. The operator
marks the enemy from intel; the system projects what they threaten (fields of fire, kill
zones, danger) and — next — how to move against them. This is **Track 1** of the SE3 Labs
challenge: turn labeled 3D geometry into operator-actionable judgments in < 10 s.

## The product model (IMPORTANT — read this first)

**It is operator-driven, not auto-generated.** We deliberately deleted the old
auto-templating (inferring enemy positions by viewshed reciprocity) — it produced
unrealistic, co-located laydowns. The current flow:

1. App opens **blank** (terrain + object boxes only).
2. Operator picks an enemy **type** (sniper_op / tank / mortar) and **clicks the map** to
   place each enemy where real intel says it is. Optionally places our own positions too.
3. **Analyse threat** → `POST /api/threat/recompute` → backend builds the laydown
   (`threat_template.from_manual`) and projects the fields (`fields.run`) → page reloads →
   enemy markers + sectors of fire + **kill zones** + **danger** appear.

The frontend only reveals the threat once analysed: it gates on
`threat.json.avenue_source === 'operator'` (see `SceneCanvas.tsx`). A stale/auto laydown
is never shown.

## Architecture

- **Backend** — Python + **FastAPI** (`src/backend/app.py`). Packs the cloud once on startup
  (3.6 M pts @ 0.1 m voxel) and serves it; computes terrain/visibility/fields. Runs on `:8011`.
- **Frontend** — **React + Vite + TypeScript + TailwindCSS + zustand**, with raw **three.js**
  in `src/frontend/src/engine/Viewer.ts`. Runs on `:5173` (Vite proxies `/api` → `:8011`).
  The engine is imperative and owns the WebGL scene; React calls its methods via the store.

```
data/                      provided inputs — gitignored (get from the SE3 mentor)
  point_cloud.ply          ~4M pts, double x,y,z (UTM metres) + uchar r,g,b. NO labels/normals.
  bounding_boxes.json      58 oriented object boxes (house/shelter/container/wall/car) + avg_temperature
src/
  config.json              shared backend/frontend ports + cloud voxel/max_points
  backend/
    io.py                  zero-copy PLY reader (read_ply → numpy memmap)
    app.py                 FastAPI: pack_cloud on startup, serves /api/*, /api/threat/recompute
    terrain.py             build_dsm: DSM from cloud + the 58 boxes stamped as occluders → build/dsm.tif
    visibility.py          viewshed(): radial line-of-sight on the DSM (the core primitive)
    fields.py              project a laydown → engagement-area DEPTH (kill zones), DANGER cost,
                           sectors of fire, TRPs on chokepoints (range-graded, two target heights)
    threat_template.py     from_manual(enemies, friendly): build threat.json from placed enemies
    scripts/inspect_ply.py print PLY header + stats
  frontend/src/
    engine/Viewer.ts       the three.js world (cloud, boxes, markers, overlays, picking, placement)
    components/            SceneCanvas (mounts engine), Hud (modes/legend), FriendlyPanel
                           (enemy/friendly placement + Analyse), ObjectPopup, ThreatPopup/Panel
    lib/                   api.ts (fetch + postRecompute), store.ts (zustand), types.ts, colors.ts, utils.ts (w2v/v2w)
build/                     generated, gitignored: dsm.tif, viewshed.*, threat.json, danger.bin, depth.bin, fields.json
docs/                      challenge + data findings + tactical concept (PARTIALLY STALE — see below)
```

## Run it

```bash
uv sync                                   # python deps (numpy, fastapi, uvicorn, rasterio, shapely, scipy)
# drop the two provided files into data/  (point_cloud.ply, bounding_boxes.json — gitignored)
cd src/frontend && npm install && cd ../..
./run.sh                                  # starts uvicorn (:8011) + vite (:5173); open http://localhost:5173
```

`./run.sh` reads ports from `src/config.json`. The "LOS" viewshed mode also needs a one-off
`uv run python src/backend/visibility.py` to write `build/viewshed.*`.

## Color modes / overlays (Hud)

RGB · Height · Temp. (boxes by thermal) · **LOS** (interactive viewshed — click a point) ·
**Danger** (continuous cost surface) · **Kill zone** (engagement-area depth = overlapping
fields of fire). The **"over RGB map"** toggle blends any overlay onto the real photo.
Danger/Kill require an analysis; LOS requires `visibility.py` to have run.

## Conventions

- **Python ≥ 3.12 via uv**; **ruff** (line-length 135, type hints/ANN, `# noqa: E402` after the
  `ROOT`/sys.path bootstrap). Scripts resolve root via `Path(__file__).resolve().parents[N]`.
- **Frontend**: no business logic in React — the engine (`Viewer.ts`) owns the scene; React
  components read/write the **zustand store**; `SceneCanvas` forwards store → engine via effects.
- **Coordinates**: everything UTM metres. Viewer frame mapping = **east→X, elevation→Y(up),
  north→−Z** (`w2v`/`v2w` in `lib/utils.ts`). The cloud is recentred to a local origin
  (`meta.origin`) because UTM doubles exceed float32 precision.
- **Ground decals** (rings, sector wedges, TRP crosshairs) use `depthTest:false` + high
  `renderOrder` (the `decal()` helper) so they draw over the terrain, not buried under it.
- **Never commit data**: `data/*.{ply,json}`, `build/`, `src/frontend/public/*`, node_modules,
  `.venv`, and rendered `*.png/*.jpg` are gitignored.

## Git / workflow (shared repo)

- Repo: `github.com/patrickab/se3-reconnaisance`. **Two people** work on it (this user +
  collaborator `patrickab`) — expect frequent merges; resolve conflicts by keeping BOTH
  features (his work and ours are usually additive).
- **Do NOT `git commit`/`push` without analysing with the user first** and getting explicit
  approval — it's a shared `main`. Work on feature branches off `main`.
- End-to-end verification is expected: after frontend edits, **restart Vite** (WSL inotify does
  not detect `/mnt/d` edits, so HMR silently serves stale modules), then drive the headless
  browser (Playwright) to confirm it renders.

## Gotchas

- **WSL + Vite HMR is broken** for `/mnt/d` — always restart `vite` after editing frontend.
- `pkill`/background `&` in the Bash tool often returns exit 144 even on success — verify with a
  follow-up `curl`, and prefer the harness's `run_in_background` for long-lived servers.
- `Analyse` is ~15 s (rebuilds DSM + projects fields). Caching the DSM is a known speed-up TODO.
- `np.ptp(arr)` not `arr.ptp()` (numpy ≥ 2.5); `Date.now()/Math.random()` unavailable in
  workflow scripts.

## Status / next

Built: terrain DSM + vectorized viewshed; manual enemy placement (8 unit types incl. AT/ATGM
teams); **unit & weapon realism** (two arcs — observation vs weapon sector; Hill p_hit accuracy
curve; per-target-class effectiveness); **per-target-class risk** ("risk to: Infantry / Light veh
/ Armour"); the analysis surfaces **Risk Classification · Crossfire Indicator · Probability of
Lethal Fire (`pfatal`)**; honest reason bands (out-of-range/dead-ground/cover/exposed);
**🚨 tiered soldier danger alert** + "locate" camera fly-to; **auto-project** on placement (no
button/reload); unit **move mode**; **3D unit GLB models**; NATO symbology; empty-by-default;
the React/FastAPI app. See `docs/ANALYSIS_LAYER.md` for the full design + roadmap.

Next candidates (ranked, NOT built): **`routes.py`** (covered approach / exposure / dead-ground —
"how do I get there alive") → **objective lens** (operator picks move/seize/control/destroy →
reweight + surface; needs friendly-side fields + the per-shooter viewshed stack) →
**`landcover.py`** (vegetation→concealment + bare-earth DTM, fixes the tree-canopy-as-opaque
issue) → **tablet Q&A**.

> `docs/` was refreshed (2026-06-28) to match the current architecture — `architecture.md`,
> `module-map.md`, `THREAT_LIBRARY.md`, `MANEUVER_ANALYSIS.md`, `current-focus.md`,
> `conventions.md`, `README.md`, `ANALYSIS_LAYER.md` now reflect the operator-driven model +
> the shipped analysis layer. `repo-context.md` is a Repomix auto-generated dump (regenerate,
> don't hand-edit).
````

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

## File: docs/ANALYSIS_LAYER.md
````markdown
# Analysis Layer — design & roadmap

> The "make it tactically useful" phase. Synthesised from a 5-agent research pass
> (capability audit, objective→analysis matrix, risk zones, movement/maneuver, tablet Q&A),
> each grounded in the actual backend. This file is the build reference; trust it + the code
> over the older docs.

## The core architecture: one engine, objective as a lens

The same enemy laydown needs **different outputs per mission objective** — but **not different
engines**. Every objective is a **weighting + surfacing rule over one common substrate** of
spatial layers, all of which fall out of two primitives we already have: `viewshed()`
(`visibility.py`) and `fields.run()` (`fields.py`). This is OAKOC/KOCOA computed once, read
through a mission filter.

Compute the substrate once on **Analyse** (~15 s); switching objective is then a **sub-second
reweight** → the operator scrubs objectives live over a frozen laydown, inside the <10 s tablet
budget.

**Shared substrate layers** (build once): intervisibility/threat observation (`depth`),
lethality/danger cost, cover-vs-concealment, dead ground, indirect coverage, chokepoints/TRPs,
**friendly-side fields** (same projection run from our units), key-terrain scoring.

**Objective = three knobs:** (1) a weight vector over the layers, (2) a target set (the point/
area/enemy the operator draws), (3) a surfacing rule (the 1–3 things shown).

| Objective | Tablet shows (1–3 things) |
|---|---|
| Move / infiltrate | least-exposure route + exposure profile + dead-ground bounds |
| Seize / secure | covered approach + breach face in dead ground + support-by-fire pos + suppression list |
| Control / dominate | ranked key terrain + own vulnerability there + blind approaches to cover |
| Destroy / attrit | enemy blind arcs & dead ground + mutual-support seams + firing positions + flank axis |
| Defend / hold | enemy avenues in + own engagement areas + own gaps + TRP/indirect plan + covered fallback |
| Clear | clearing sequence + dangerous crossings + squirter routes to block |
| Raid | dual disjoint ingress/egress + brief strike position + break-contact dead ground |

## The three enablers (small changes, biggest payoff)

1. **Persist the per-shooter viewshed stack.** `fields.py` computes each shooter's `vis` then
   sums it into `depth` and discards identity (`fields.py:~94-98`). Keeping the stack (≈free,
   already in memory) unlocks per-enemy dead ground, mutual-support **seams**, and per-shooter
   **suppression lists** — half the Destroy/Seize outputs.
2. **Friendly-side fields.** Run `fields.run()` from our units toward the enemy. Unlocks
   Control/Defend/Seize/Destroy ("what can WE see/shoot").
3. **`routes.py`.** Least-cost path over the danger raster we already build; interactive
   (<100 ms, no rebuild). The headline "how do I get there alive."

## ⚠️ The dominant accuracy risk: canopy = concealment, not cover

The DSM stamps tree canopy as a **solid occluder** (`terrain.py`), so "dead ground" behind a
treeline reads as *safe* — but it's only **concealment** (hides you from optics), **not cover**
(a round / thermal sight / pre-registered mortar still kills you). Every "safe corridor" along
vegetation is concealment dressed as cover — exactly where infantry move.

- **Honest interim (now):** label `CONCEALED` vs `COVERED` everywhere; only call a cell
  round-stopping cover when it's masked by a **box** (`box_mask`/`cover_near`), not by an
  unknown occluder. Dead ground adjacent to a box → likely true defilade (upgrade); open-field
  dead ground far from any box → suspicious canopy (low confidence).
- **Real fix:** `landcover.py` — vegetation proxy (excess-green `2G−R−B` + height) + bare-earth
  DTM (morphological opening of the cloud → `nDSM = DSM − DTM`). No ML needed for a first pass.
  Also unblocks slope/trafficability for routes.

## Data: what we have vs the gaps

**Accurate today:** surface-accurate LOS/viewsheds, fields of fire, engagement-area overlap
(kill zones), range-graded direct-fire lethality, continuous danger surface, mortar/indirect
coverage, chokepoints/TRPs — all in real UTM with metric ranges. Hard cover + LOS occlusion for
the 58 labelled boxes are trustworthy.

**Gaps (impact → cheap fix):**
- Canopy-as-opaque (above) — the big one.
- No bare-earth DTM → no slope/trafficability (needed for vehicle avenues + routes).
- Buildings are solid boxes → clearing/seize is building-granular, not room-level.
- Single static snapshot → no movement/time; all "timing" is spatial proxy (LOS-segment length).
- **Self-inflicted (free to fix):** `confidence` is collected then dropped (`threat_template`
  hardcodes `score=1.0`); `avg_temperature` (thermal) is display-only; `sec_since_contact` is
  randomly fabricated; `velocity` unused.

## Tablet Q&A — "ask the battlefield"

LLM + **tool-calling over our spatial primitives** — the model *never describes* the terrain, it
*calls* a tool and reports the numbers with intel-tied confidence. ("The tank at 717980E/5355600N
sees ~62% of the depot's north face; intel visual, 4 s old → high confidence.") Mostly thin
wrappers over existing endpoints + a `qa.py` orchestrator with a hard rule: a spatial answer with
zero tool calls is blocked. ~8 of 15 typical soldier questions answerable today; rest need the
danger-point sampler + `routes.py`. Edge/offline path: precomputed tile pack + on-device
`viewshed` + staleness stamps.

## Risk-zoning layer (BUILD #1 — ✅ SHIPPED)

Replace the turbo heatmap with **4 decision bands** tied to the `p_hit`/`depth` numbers we already
compute, with green split by *reason*:

| Zone | Rule (D=danger byte 0-255, K=depth) | Means |
|---|---|---|
| 🟥 NO-GO / kill zone | K ≥ 2 OR D ≥ 204 (p_hit ≥ 0.8) | interlocking fire — never stop |
| 🟧 HIGH | D ≥ 128 (p_hit ≥ 0.5) | cross fast or not at all |
| 🟨 MODERATE | D ≥ 51 (p_hit ≥ 0.2) OR K ≥ 1 (seen at all) | watch it |
| 🟩 LOW | K == 0 AND D < 51 | split by reason ↓ |

Green by reason: **OUT-OF-RANGE** (real safety) · **DEAD-GROUND** (hidden — *concealment caveat*,
hatched) · **COVER** (box-masked, stops rounds). Default target height = dismount 1.7 m
(worst-case for the human). Confidence (per-shooter intel) modulates fill opacity.

**Backend (`fields.py`):** emit a per-point `reason` byte (OUT_OF_RANGE/DEAD_GROUND/COVER/EXPOSED)
+ `conf` byte (max shooter confidence on seen cells), sampled like `danger.bin`/`depth.bin`.
Propagate unit `confidence` through `app.py` recompute → `threat_template` position → fields.
**Frontend:** a fused **"Risk"** colour mode banding `danger`+`depth`+`reason` (+ conf opacity)
instead of `TURBO()`; new legend.

### Built on top since (current state of the analysis layer)

The foundation above is shipped, plus the realism (next section) and these, all merged to `main`:

- **Per-target-class risk** — the "risk to: **Infantry / Light veh / Armour**" toggle. Same
  laydown, different surface per who's moving (`P(kill)=P(hit)×P(kill|hit)`; a sniper is
  invisible on the armour surface, an AT team dominates it). Per-class `*_{class}.bin` + `?class=`.
- **Probability of Lethal Fire (`pfatal`)** — a *true* marginal kill-probability surface alongside
  the planning-cost (`danger`) one: `pfatal = 1 − ∏(1 − kill_i)`, confidence-weighted, with a
  `fires.exposure_shots` multiplier (`config.json`). The HUD now exposes three analysis surfaces:
  **Risk Classification** (bands), **Crossfire Indicator** (engagement depth), **Probability of
  Lethal Fire** (`pfatal`).
- **🚨 Soldier danger alert** — `fields.py` classifies each placed friendly into a zone written to
  `fields.json.soldiers`; the frontend `DangerAlert` is a tiered (red/orange/yellow) per-soldier
  notification with a **"locate" camera fly-to**.
- **Auto-project** — placing/moving/removing a unit re-runs the projection with no button/reload
  (debounced, single-flight).
- **Unit move mode** (drag-to-reposition; place/move/remove mutually exclusive) and **3D unit
  models** (per-type GLB via GLTFLoader; the NATO icon/pole/ring stay as the pick/tactical layer).

> Mortar (indirect) note: it has no LOS to the target — its threat is a range annulus gated by
> *observation* (any enemy's eyes) **or** a pre-registered TRP, so a lone mortar shows almost
> nothing until a spotter is placed.

## Unit & weapon realism (research — supersedes the placeholder UNIT_CATALOG)

The risk surface is only as accurate as each enemy unit's arc / range / accuracy / lethality.
A 4-agent sourced pass (NATO + OPFOR specs, fires doctrine, ballistics, weapons-effects) found
the current catalog is the right shape but wrong in specifics. Four composing fixes:

### 1. Corrected, sourced ranges (+ missing types)
- **mortar `min_range = 0` is physically wrong** — mortars have a dead zone (~200 m for 120 mm);
  the threat ring must be an annulus. Add `min_range_m`.
- **`sniper` conflates three classes** → split: `dmr` (~800 m), `sniper`/bolt (~1000–1200 m),
  `am_sniper` (.50/.338, ~1700–1830 m — ranges the whole map, hurts light vehicles).
- **`assault` too low** (300/400 → point ~500, area ~600–800).
- **`ifv` max too low** (autocannon ~2500–3000; ATGM 3750–4500).
- **MISSING: dismounted anti-armour** — add `at_team` (RPG-7/AT4/NLAW, eff ~300–600/max 800,
  min 20) and `atgm_team` (Javelin/Kornet, eff ~2500/max 4000, top-attack ignores frontal cover).
  On a 1.3 km map these bracket every other unit and are the deadliest thing an operator marks.

### 2. Two arcs per unit — the 360° fix (the operator's key point)
A unit observes wider than it can shoot. Split:
- **Observation arc** (detect / react — "can they react to me here?"): ~360° for alert dismounts,
  OPs, APCs; ~120° frontal for a buttoned turret; ~180–360° for a scanning sniper.
- **Weapon / engagement arc** (lethal fire NOW): narrow, centred on the operator's heading
  (= Principal Direction of Fire). Sniper ~45°, infantry ~90–180°, turret ~90°.

The **heading aims the gun, not the eyes** — a sniper "facing the road" still has 360° detection,
so the operator can't misrepresent reality. A per-unit **posture toggle** (secure / focused /
buttoned) sets the defaults. Drive the **kill-zone/danger from the WEAPON arc**, a softer
**"observed / call-for-fire" layer from the OBSERVATION arc** (also the correct cue for the
mortar — fixes a latent bug where pure observers and the indirect gate use the weapon arc).
Implementation: trace the viewshed ONCE at the wide arc, mask to the weapon sector with cheap
numpy on the existing grids — **zero extra raycasts**.

### 3. Realistic hit-probability — replace the flat-linear `p_hit`
Current `p_hit` is linear and identical for all weapons. Replace with a 3-param Hill curve:
`p(d) = p0 / (1 + (d / d50)^β)`, `d50 = shoulder · eff_range_m`. `β` is the
"accurate-far vs far-but-inaccurate" knob: **β≈2** (assault, RPG — early knee, long tail) vs
**β≈8–9** (sniper, tank — flat then cliff). Add a separate, wider, lower **suppression** field
for MGs/autofire → an AMBER "suppressed" band distinct from the RED kill zone. (Sourced sanity:
assault Ph collapses past ~300 m; sniper holds to ~800 m; tank flat to ~2000 m.)

### 4. Weapon → target-class effectiveness (the unifying idea)
`P(kill) = P(hit) × P(kill|hit)`. In `fields.py`, `vis * pr` **already is P(hit)** — just
multiply by `E[weapon][target_class]`. Target classes reuse the two viewshed heights:
**dismount 1.7 m · light_veh 2.5 m · armour 2.5 m** (no extra raycast). E matrix (P(kill|hit)):
rifle 0.85/0.10/0.00 · HMG .50 0.95/0.65/0.10 · RPG/AT4 0.55/0.85/0.70 · ATGM 0.40/0.90/0.95 ·
autocannon 0.90/0.85/0.35 · tank 0.80/0.95/0.95 · sniper 0.90/0.10/0.00. A weapon with
`E[armour]=0` (a rifle) **drops out** of the armour surface entirely. So the **same laydown
yields a different kill zone per "who's moving"** — pick **"show risk to: dismount / light / armour."**
The armour surface collapses to a few short AT fans + the enemy tank — exactly the question
"if I push my armour up this axis, what threatens it?"

### The composed refactor
All four land on **one** change to two files:
- **`units.py`** — promote a `Weapon` entity {eff/max/min range, ph params p0·shoulder·β, supp s0,
  `weapon_arc`, `E[target_class]`, fire_kind}; `Unit` = sensor envelope (`obs_arc`, `obs_range`) +
  a default **loadout** of weapons; `UnitContact` gains operator-editable `weapons` + `posture`.
- **`fields.py`** — loop per (unit, weapon); viewshed once at the wide obs arc → observation
  layer; angular-mask to weapon arc → lethal layer; `kill = vis · p_hit(Hill) · E[weapon][class]`;
  per-target-class `danger/depth/suppress` bins (`?class=` on the endpoints, default dismount).

**MVP** (most realism, least code): corrected ranges + AT types, the two arcs, the Hill curve,
and a per-unit `E[class]` dict with the "show risk to" toggle — no first-class Weapon entity yet.
**Full**: `Weapon` entities + operator weapon-selection chips (assault team + AT4; IFV gun + ATGM).

> ⚠️ This means the risk-foundation bands (no-go/high/mod/low, tied to p_hit/depth) are correct,
> but the p_hit values, arcs, and per-class surfaces they read must be upgraded for accuracy
> **before** the risk foundation is trustworthy enough to commit.

## Recommended build order

1. ✅ **Risk foundation + honesty fixes** — bands, reason, confidence wiring. **DONE.**
1b. ✅ **Unit & weapon realism** (two arcs, Hill p_hit, per-target-class effectiveness, AT/ATGM types). **DONE.**
1c. ✅ **P(fatal) surface + soldier danger alert + 3D models + move mode + auto-project.** **DONE.**
2. ⬜ **`routes.py`** — covered approach (needs the per-shooter stack first). *Not built.*
3. ⬜ **Objective lens** — operator picks objective → reweight + surface (needs friendly-side fields). *Not built.*
4. ⬜ **Tablet Q&A** — tool-calling orchestrator. *Not built.*
5. ⬜ **`landcover.py`** — the accuracy unlock (canopy = concealment); can slot earlier if movement advice must be field-grade. *Not built.*
````

## File: docs/challange.md
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

## Judging (EDTH)

1. Real problem?
2. Effective?
3. Original?
4. Deployable / mass-manufacturable?
5. Progress & drive **during** the event. → A working live demo beats slides; an honest "here's where it breaks" beats over-claiming. Output must be **operator-actionable in < 10 seconds**.

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
````

## File: docs/data.md
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

## File: docs/THREAT_LIBRARY.md
````markdown
# Threat Library — the unit / weapon model

> Reference for the **enemy (and friendly) asset model**: every battlefield actor
> the operator can place, with its sensor and weapon envelope. The operator marks
> the enemy from real intel (Track 1 is **operator-driven**, not auto-templated);
> this catalog defines what each placed contact then *threatens*, and the
> projection (`fields.py`) turns those envelopes into fields of fire, kill zones
> and the danger surface on the terrain.

**Single source of truth: `src/backend/units.py` (`UNIT_CATALOG`).** Both the
analysis chain (`threat_template.py` → `fields.py`) and the frontend (via
`GET /api/unit-profiles`) read from it — neither keeps its own copy. The numbers
below are pulled directly from that file; if they ever disagree, the code wins.

Specs are **engagement-envelope parameters**, not exact ballistics — doctrinal
defaults (NATO + OPFOR open-source specs, fires doctrine, ballistics) good enough
to drive terrain-grounded tactical reasoning, honest about being a model.

---

## The model — how a unit threatens a cell

Each unit type is a static `Unit` (a doctrinal sensor/weapon envelope). A placed
instance is a `UnitContact` (position + heading + intel confidence). The fields
projection reads these per-type properties:

### Two arcs — observation vs lethality
- **`obs_arc`** — the **OBSERVATION** sector (degrees): *"can they detect me?"*.
  Wide / near-360° for alert dismounts and scanning snipers; frontal for a
  buttoned turret. The union of every unit's observation arc is the
  **observation map** — and that map is what gates indirect fire.
- **`weapon_arc`** — the **LETHAL** sector of fire (degrees), centred on the
  operator-set heading (the Principal Direction of Fire): *"can they kill me here,
  now?"*. Narrow (a hull-down tank covers an arc, not 360°).

Line of sight is traced once at the wide `obs_arc`; the lethal layer then masks
that viewshed down to `weapon_arc`. (LOS is arc-independent, so the two-arc model
costs no extra ray casts.)

### Range envelope
- **`eff_range_m`** — effective engagement range.
- **`max_range_m`** — maximum range; `p_hit` fades to ~0 past it.
- **`min_range_m`** — inner **dead zone** (mortar / ATGM arming distance; 0 for
  most direct weapons). A cell is engageable only in the annulus `[min, max]`.

### Range-graded hit probability (Hill curve)
`fields.p_hit` gives single-shot P(hit) vs a point target as a Hill curve, zero
outside `[min, max]`:

```
p_hit(d) = ph_p0 / (1 + (d / d50) ** ph_beta) ,   d50 = ph_shoulder * eff_range_m
```

- **`ph_p0`** — plateau / point-blank single-shot P(hit).
- **`ph_shoulder`** — places the knee: `d50 = ph_shoulder · eff_range_m` is the
  range at which P(hit) has fallen to half of `p0`.
- **`ph_beta`** — steepness. High = *accurate-far-then-cliff* (tank FCS, ATGM,
  sniper); low = *far-but-inaccurate* (autocannon, RPG).

A global exposure window (`fires.exposure_shots` in `config.json`, default 1)
turns single-shot into cumulative `P = 1 − (1 − p)^n`.

### Suppression
- **`supp_s0`** — suppression plateau (the wide, low MG beaten zone, autofire).
  `fields.p_supp` spreads it as `s0 / (1 + (d / (1.05·max))^3)`. **0** for
  precision weapons (sniper, mortar, ATGM) → no suppression field.

### Per-target-class effectiveness — `eff`
`eff = {dismount, light_veh, armour}` is **P(kill | hit)** per target class. This
is what makes one laydown threaten three movers differently: the risk surface is
built **per class**, and a weapon with `eff[class] == 0` (a rifle vs armour) drops
out of that class's surface entirely.

So per shooter, per class: `P(kill) = LOS × p_hit × eff[class]`, unioned
probabilistically across all shooters, weighted by each contact's intel
`confidence`. Engagement-area **depth** is the count of weapons that can kill a
cell; depth ≥ 2 = a **mutually-supporting kill zone** (cross-fire).

---

## The catalog (8 unit types)

Pulled from `UNIT_CATALOG`. `obs` = observation arc, `wpn` = lethal weapon arc.
Ranges in metres; `min` is the dead zone.

| key | label | class | role | fire | obs° | wpn° | eff | max | min | eye (AGL) |
|-----|-------|-------|------|------|-----:|-----:|----:|----:|----:|----:|
| `tank` | Main Battle Tank | heavy | anti-armor | direct | 120 | 90 | 2200 | 2500 | 0 | 2.5 |
| `ifv` | Infantry Fighting Veh. | heavy | anti-armor | direct | 120 | 90 | 1500 | 2500 | 0 | 2.5 |
| `apc` | Armoured Transporter | medium | observer | direct | 270 | 90 | 1500 | 2000 | 0 | 2.0 |
| `assault` | Assault Troops | light | observer | direct | 270 | 180 | 500 | 700 | 0 | 1.5 |
| `sniper` | Sniper / OP | light | observer | direct | 200 | 45 | 1000 | 1300 | 0 | 1.7 |
| `mortar` | Mortar Team | light | indirect | **indirect** | 0 | 360 | 7000 | 7000 | 200 | 1.5 |
| `at_team` | AT Team (RPG) | light | anti-armor | direct | 180 | 90 | 400 | 800 | 20 | 1.5 |
| `atgm_team` | ATGM Team (Javelin) | light | anti-armor | direct | 180 | 90 | 2500 | 4000 | 65 | 1.5 |

Lethality parameters — Hill curve (`p0` / `shoulder` / `beta`), the derived knee
`d50 = shoulder·eff`, suppression `s0`, and `eff` = P(kill|hit) per class:

| key | p0 | shoulder | beta | d50 (m) | supp s0 | eff dismount | eff light_veh | eff armour |
|-----|---:|---:|---:|---:|---:|---:|---:|---:|
| `tank` | 0.98 | 1.36 | 9.0 | 2992 | 0.20 | 0.80 | 0.95 | 0.95 |
| `ifv` | 0.90 | 1.00 | 4.0 | 1500 | 0.50 | 0.90 | 0.85 | 0.35 |
| `apc` | 0.70 | 0.63 | 2.4 | 945 | 0.65 | 0.95 | 0.65 | 0.10 |
| `assault` | 0.95 | 0.90 | 2.2 | 450 | 0.35 | 0.85 | 0.10 | 0.00 |
| `sniper` | 0.97 | 1.19 | 8.0 | 1190 | 0.00 | 0.90 | 0.10 | 0.00 |
| `mortar` | — | — | — | — | 0.00 | 0.75 | 0.45 | 0.05 |
| `at_team` | 0.85 | 0.87 | 2.0 | 348 | 0.10 | 0.55 | 0.85 | 0.70 |
| `atgm_team` | 0.90 | 1.20 | 12.0 | 3000 | 0.00 | 0.40 | 0.90 | 0.95 |

The mortar's Hill params are unused (indirect uses an area/annulus path, see
below); its `eff` still grades how lethal a round is per class.

### Per-type character (why the numbers look the way they do)
- **Main Battle Tank** — 120 mm APFSDS + FCS: `p0` 0.98, `beta` 9 (deadly-accurate
  far, then a cliff), kills everything (`eff` 0.80 / 0.95 / 0.95). Narrow 90° turret
  arc, wide 120° optics; large close-in / behind-mask dead zones.
- **Infantry Fighting Vehicle** — autocannon (+ATGM): high P(hit) inside ~1.5 km,
  shreds dismounts and light vehicles, only `eff` 0.35 vs armour (cannon, not gun).
  Some suppression (`s0` 0.50).
- **Armoured Transporter (APC)** — `.50` HMG: an *observer* role, dominant vs
  dismounts (`eff` 0.95) and a heavy beaten zone (`s0` 0.65), near-useless vs armour
  (0.10). Wide 270° optics with a rear blind spot.
- **Assault Troops** — 5.56 rifle: short (eff 500, max 700), `eff` 0.85 vs
  dismounts, ~0 vs vehicles. Wide 270° observation, broad 180° assigned sector.
- **Sniper / OP** — 7.62 bolt/DMR: precise (`p0` 0.97, `beta` 8), narrow 45° lethal
  arc but scans a wide 200° sector. Denies a corridor to dismounts; the viewshed
  *is* the threat. No suppression.
- **Mortar Team** — 120 mm **indirect** (see below).
- **AT Team (RPG)** — RPG-7 / AT4: short (eff 400, max 800), 20 m arming dead zone,
  strong vs vehicles/armour (0.85 / 0.70), middling vs dismounts.
- **ATGM Team (Javelin)** — top-attack guided: long (eff 2500, max 4000), 65 m dead
  zone, `beta` 12 (very flat then sharp cut-off), armour-killer (0.95), poor vs
  dismounts (0.40).

---

## Direct vs indirect — the one distinction that organises the math

`fire_kind` decides which projection pass a unit enters:

| Mode (`fire_kind`) | Needs line of sight? | Defeated by | In catalog |
|--------------------|----------------------|-------------|------------|
| **direct** | **Yes** — the shooter must see you | dead ground, defilade, cover, breaking LOS | tank, ifv, apc, assault, sniper, at_team, atgm_team |
| **indirect** | **No** — arcs over terrain | denying **observation** (concealment, speed) and being out of range | mortar |

**Indirect (mortar) special case.** A mortar has no line of sight and no sector of
fire. In `fields.run` it threatens its **range annulus** `[min_range, max_range]`
(the 200 m → 7000 m ring), but a cell in that annulus is only *dangerous* when it is
also either **observed** — covered by the union of every unit's observation arc — or
falls under a **pre-registered TRP**. TRPs are seeded automatically on
terrain-forced chokepoints (narrow passages on the medial axis of the passable
terrain), so an attacker can't game the map by hugging dead ground through a
registered defile. The indirect danger weight is `clip(0.6·observed + 0.7·trp, 0,
0.9)`, then scaled by the mortar's per-class `eff`.

---

## How a laydown is built (operator-driven)

1. Operator picks a unit **type** and **clicks the map** to place each contact
   (`POST /api/units` → `PlaceUnitRequest`); the backend fills the doctrinal
   envelope from `UNIT_CATALOG`. Optionally places friendly positions too.
2. The frontend auto-projects on change: `POST /api/threat/recompute` →
   `threat_template.from_manual` writes `build/threat.json` (each shooter oriented
   on its operator-set heading, or onto our positions if no heading) →
   `fields.run` projects the fields and writes the per-class surfaces.
3. The threat is revealed only once analysed — the frontend gates on
   `threat.json.avenue_source === 'operator'`.

There is **no auto-templating** (the old viewshed-reciprocity placement was
deleted — it produced unrealistic, co-located laydowns). The human provides ground
truth; the system does the spatial reasoning.

> Legacy alias: `sniper_op` resolves to `sniper` (`units.resolve_unit`) so the
> older threat-template key still maps onto the canonical type.

---

## Data caveat — concealment vs cover

The DSM treats tree canopy as a **solid occluder**, so "dead ground" behind
vegetation is really **concealment** (it hides you) — it does **not** stop a round
like a wall (**cover**) does. The projection tags those cells as lower-confidence,
not safe (reason code `dead-ground` ≠ `cover`). A proper bare-earth / land-cover
layer (`landcover.py`) is the planned fix.

---

## Sources
- Tank gun / FCS & gun-launched ATGM: [T-90 / 2A46M](https://en.wikipedia.org/wiki/T-90) · [9M119 Refleks](https://en.wikipedia.org/wiki/9M119_Svir/Refleks)
- IFV autocannon: [2A42 30 mm](https://en.wikipedia.org/wiki/Shipunov_2A42)
- Sniper/DMR ranges: [SVD Dragunov](https://en.wikipedia.org/wiki/SVD) · [Orsis T-5000]
- AT / ATGM: [RPG-7](https://en.wikipedia.org/wiki/RPG-7) · [FGM-148 Javelin](https://en.wikipedia.org/wiki/FGM-148_Javelin) · [9M133 Kornet](https://en.wikipedia.org/wiki/9M133_Kornet)
- Mortar: [2S12 Sani 120 mm](https://en.wikipedia.org/wiki/2S12_Sani)
- Doctrine: [FM 34-130 IPB](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
</content>
</invoke>
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

## File: src/backend/terrain.py
````python
"""Terrain layer — build a Digital Surface Model (DSM) from the point cloud.

The DSM is the height grid every visibility computation runs on. We also stamp the
58 oriented object boxes into it as solid occluders, so buildings/walls block
line-of-sight even where the cloud is sparse. Output is a georeferenced GeoTIFF
(UTM) — the authoritative, reusable layer — plus the arrays in memory.

    uv run python src/backend/terrain.py [--res 1.0]
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.io import read_ply  # noqa: E402
⋮----
DATA = ROOT / "data"
BUILD = ROOT / "build"
# UTM zone is unconfirmed (looks like 32N / Bavaria) — analysis uses only the
# metric transform, so the EPSG is a label, overridable with --epsg.
DEFAULT_EPSG = 32632
⋮----
def box_yaw(box: dict) -> float
⋮----
"""Yaw (rad) from the [0,0,qz,qw] quaternion."""
⋮----
def box_polygon(box: dict) -> Polygon
⋮----
"""Footprint of an oriented box as a world-coordinate (UTM) polygon."""
⋮----
local = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
⋮----
v = read_ply(ply_path)
⋮----
w = int(np.ceil((xmax - xmin) / res))
h = int(np.ceil((ymax - ymin) / res))
transform = from_origin(xmin, ymax, res, res)  # north-up
⋮----
col = np.clip(((x - xmin) / res).astype(np.int64), 0, w - 1)
row = np.clip(((ymax - y) / res).astype(np.int64), 0, h - 1)
flat = np.full(w * h, -np.inf)
order = np.argsort(z, kind="stable")            # last write per cell = highest point
⋮----
dsm = flat.reshape(h, w)
valid = np.isfinite(dsm)                          # cells with real cloud data
⋮----
n_boxes = 0
⋮----
boxes = json.loads(boxes_path.read_text())
shapes = [(box_polygon(b), b["center"][2] + b["extent"][2] / 2) for b in boxes]
tops = rasterize(shapes, out_shape=(h, w), transform=transform, fill=np.nan,
m = ~np.isnan(tops)
base = np.where(np.isnan(dsm), -np.inf, dsm)
dsm = np.where(m, np.maximum(base, tops), dsm)
n_boxes = len(boxes)
⋮----
dsm = _fill_gaps(dsm)
⋮----
def _fill_gaps(dsm: np.ndarray) -> np.ndarray
⋮----
nan = np.isnan(dsm)
⋮----
idx = distance_transform_edt(nan, return_distances=False, return_indices=True)
dsm = dsm[tuple(idx)]
⋮----
def world_to_pixel(transform: rasterio.Affine, x: float, y: float) -> tuple[int, int]
⋮----
nodata = np.nan if dtype.startswith("float") else 0
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Build the DSM from the point cloud")
⋮----
args = ap.parse_args()
⋮----
t = build_dsm(args.ply, args.res, args.boxes, args.epsg)
out = BUILD / "dsm.tif"
````

## File: src/frontend/src/components/AnalyzingSpinner.tsx
````typescript
import { useStore } from '../lib/store'
⋮----
/** Top-centre "Analysing threat" indicator shown while the fires/observation
 *  fields are being projected. Driven by the auto-recompute in SceneCanvas —
 *  analysis no longer rerenders the scene, so this pill is the only visible signal. */
export default function AnalyzingSpinner()
````

## File: src/frontend/src/components/InfoPanelPopup.tsx
````typescript
import { ScreenPoint } from '../lib/types'
⋮----
interface Props {
  screen: ScreenPoint | null
  width?: number
  header: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}
⋮----
/**
 * Shared layout shell for all information popups anchored to a scene object.
 * Position is driven by `screen` — a projected world coordinate that updates
 * as the camera moves, keeping the popup spatially locked to its subject.
 * See .docs/conventions.md § Information Panel Popup for the full contract.
 */
export default function InfoPanelPopup(
⋮----
export function DataRow(
````

## File: src/frontend/src/components/PlacedUnitPopup.tsx
````typescript
import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
````

## File: src/frontend/src/components/ThreatPanel.tsx
````typescript
import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'
⋮----
/** Ranked list of likely enemy positions; visible in Threat color mode. */
export default function ThreatPanel()
````

## File: src/frontend/src/main.tsx
````typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
````

## File: src/frontend/postcss.config.js
````javascript

````

## File: src/frontend/tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
````

## File: src/frontend/vite.config.ts
````typescript
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
⋮----
// Single source of truth, shared with the backend (src/config.json).
````

## File: src/__init__.py
````python

````

## File: docs/MANEUVER_ANALYSIS.md
````markdown
# Maneuver Analysis — covered approach (PLANNED next phase)

> **Status: NOT YET BUILT.** This document is the *design intent* for the maneuver /
> covered-routing phase — the "how do I get there alive" answer. It is the planned
> follow-on to the threat-projection layer that exists today, **not** a description of a
> shipped feature. See [ANALYSIS_LAYER.md](ANALYSIS_LAYER.md) for the authoritative roadmap
> (`routes.py`, the objective lens) and [current-focus.md](current-focus.md) for what is
> actually done now.
>
> ⚠️ Earlier versions of this file described maneuver as flowing from an *auto-templated*
> red laydown (enemy positions inferred by viewshed reciprocity). **That auto-templating was
> deleted.** The product is operator-driven: the operator marks the enemy from intel, and
> optionally marks our own positions; the system projects threat fields from those marks.
> Everything below is framed against that current model.

## What exists today (the substrate maneuver will consume)

The threat-projection layer is built and merged. From an **operator-placed** laydown it
projects, in real UTM metres, over the 3D reconstruction:

- per-target-class **risk zones** (Risk Classification mode) and the continuous danger cost,
- engagement-area depth / **crossfire** (overlapping fields of fire),
- a **probability-of-lethal-fire** surface (`P(fatal)`),
- sectors of fire (observation arc vs weapon arc) and chokepoint TRPs,
- a tiered **soldier danger-alert** that warns when a placed friendly is exposed.

These are the **threat side** ("where will I die"). Maneuver is the **movement side** layered
on top — and it is the planned next work, not yet implemented.

## The principle (design intent): observation gates lethality

Both fire modes collapse to one question — **can the enemy observe this ground?**
- **Direct fire:** a weapon with LOS to you, and you in range → you can be shot now.
- **Indirect fire:** *any* observer with LOS to you, you in range, kill-chain closes → you
  can be shelled.

So the spine of the maneuver analysis is the same **viewshed** primitive the threat layer
already builds (`visibility.py` / `fields.py`), with weapon ranges and arcs layered on top.
The route phase does not need a new engine — it reweights and traverses the substrate that
`fields.run()` already produces.

## The cost surface maneuver will traverse (design intent)

Routing is **not** an ML prediction — it is terrain-logic optimisation (like routing around
traffic): deterministic, explainable, no training data. The planned `routes.py` finds the
cheapest path from a line-of-departure to an objective over the danger raster we **already
build**:

```
cost(step) = distance
           + α·exposure_to_observation        ← time spent observed
           + β·direct_fire_lethality           ← danger along the step
           + γ·indirect_risk
           + δ·traversability_penalty          ← slope / bad surface (needs landcover/DTM)
           − concealment_credit                ← moving through vegetation
```

The hard, interesting part is **defining exposure** — and it loops straight back into the
viewshed engine. The route-finder itself (Dijkstra / A* on the cost raster) is a solved
primitive. Output should favour **dead ground, defilade, concealed corridors, and the lee of
buildings** — the path a good NCO would pick, with the reasons made explicit.

> Dependency: covered routing wants the **per-shooter viewshed stack** (currently summed and
> discarded in `fields.py`) for per-enemy dead ground and suppression lists, plus
> **`landcover.py`** for trafficability. See ANALYSIS_LAYER.md "three enablers."

## What the operator would get (planned outputs — none shipped yet)

1. **Covered approach axis** — the recommended route on the 3D view, with the % unseen vs
   exposed and *where* the exposed stretches are.
2. **Bound / overwatch plan** — where to bound cover-to-cover and which friendly
   support-by-fire positions can overwatch each bound (overwatch element stays within
   supporting range of the bounding one).
3. **Suppression priority (HVT list)** — rank the enemy assets by how much of *your* approach
   they dominate, and the friendly position(s) from which you can engage each while staying
   concealed (the mirror of the threat projection, run from our units).
4. **Dead-ground / assembly areas** — terrain hidden from all enemy observers: where to mass,
   form up, or treat casualties.
5. **Chokepoints** — where viable routes funnel (and where the enemy expects you): avoid or
   seize/clear first.
6. **Obscuration cue** — where a sightline can't be avoided, mark *where smoke* breaks the
   critical observation so the bound is survivable.
7. **The call** — **GO / NO-GO / GO-WITH-CONDITIONS**, e.g. *"Go: covered axis along the
   eastern treeline, 85% concealed; suppress the tank at grid …; smoke the 70 m open stretch
   at grid …; assembly in dead ground behind building 36."*

All of it in **UTM / MGRS grid references and metres** — operators think in grids, and it
costs us nothing because the data is georeferenced.

## Where maneuver fits the broader plan

Maneuver/routing is one objective among several. The roadmap (ANALYSIS_LAYER.md) frames the
**objective lens**: one engine, the mission objective (move / seize / control / destroy /
defend / clear / raid) selected as a *weighting + surfacing rule* over the same substrate.
"Move / infiltrate" is the least-exposure route described here; the others reweight the same
layers. Building `routes.py` (the covered approach) is the headline first step; the objective
lens generalises it and needs **friendly-side fields** as well.

## Build dependencies (planned order)

| Layer | Source | Status |
|-------|--------|--------|
| terrain surface (DSM) | point cloud | **built** (`terrain.py`) |
| occluders / hard cover | the 58 boxes | **built** (stamped into DSM) |
| viewshed engine | DSM + boxes | **built** (`visibility.py`) |
| threat fields (danger / depth / risk / P(fatal)) | operator laydown + `fields.py` | **built** |
| per-shooter viewshed stack | keep `fields.py` per-shooter `vis` | planned (enabler) |
| friendly-side fields | run `fields.run()` from our units | planned (enabler) |
| concealment / DTM trafficability | `landcover.py` | planned |
| route + COA outputs | cost raster + A* | planned (`routes.py`) |

## Honest limits (say these to the jury)

- The cloud is **~4 pts/m², top-down** → rich **2.5D surface**, not volumetric. We claim
  **surface-accurate multi-level visibility** (viewshed over real roofs/walls/canopy, which
  beats a flat bare-earth heightmap) — *not* see-through walls or building interiors.
- Engagement envelopes are **doctrinal models**, not ballistics — they bound the reasoning,
  they don't simulate a shell.
- Enemy positions are **operator-placed from intel** (no auto-templating); a single static
  pass means no change detection and no tracking of enemy movement.
- **Canopy reads as opaque cover today** (the DSM stamps tree canopy as a solid occluder), so
  "dead ground" behind a treeline is really **concealment, not cover**. `landcover.py` is the
  planned fix; until then, any covered-route advice must flag this caveat.

## Sources
- [Fire and movement](https://en.wikipedia.org/wiki/Fire_and_movement) · [Bounding overwatch](https://en.wikipedia.org/wiki/Bounding_overwatch) · [Enfilade and defilade / dead ground](https://en.wikipedia.org/wiki/Enfilade_and_defilade)
- [FM 34-130 IPB](https://irp.fas.org/doddir/army/fm34-130.pdf) · [ATP 2-01.3 IPB (situation template, avenues of approach, COA)](https://home.army.mil/wood/application/files/8915/5751/8365/ATP_2-01.3_Intelligence_Preparation_of_the_Battlefield.pdf)
- [Russia's reconnaissance-strike kill chain, Ukraine (CEPA)](https://cepa.org/comprehensive-reports/adaptation-under-fire-mass-speed-and-accuracy-transform-russias-kill-chain-in-ukraine/)
````

## File: src/backend/README.md
````markdown
# Backend

Python data IO, the API server, and the tactical-analysis layer.

- `io.py` — zero-copy PLY reader (`read_ply` → numpy structured memmap).
- `app.py` — FastAPI app: voxel-downsamples + packs the cloud on startup (in RAM,
  via `pack_cloud`), serves the viewer at `/` and `api/{meta,cloud,boxes}`, plus
  `api/viewshed{,-info}` when present. High-resolution default (0.1 m/voxel,
  ~3.9M points).
- `terrain.py` — build the DSM from the cloud, stamp the 58 boxes as occluders,
  save a georeferenced GeoTIFF (`build/dsm.tif`). The height grid everything runs on.
- `visibility.py` — radial line-of-sight viewshed from an observer. Writes
  `build/viewshed.{tif,bin,json}`; the `.bin/.json` use `pack_cloud`'s exact points
  so the per-point overlay aligns with what the viewer serves.
- `scripts/inspect_ply.py` — print header + statistics (sanity-check the data).

## Setup

```bash
uv sync                  # numpy · fastapi · uvicorn · rasterio · shapely · scipy
uv run python src/backend/visibility.py     # optional: build the viewshed overlay
./run.sh                 # serve at http://localhost:8011
uv run python src/backend/scripts/inspect_ply.py   # sanity-check the data
```

Generated layers land in `build/` (gitignored). The viewer's **viewshed** mode
lights up once `visibility.py` has run; otherwise that button stays disabled.

## Roadmap (tactical layer continues here)

Built so far: `terrain.py` (DSM) + `visibility.py` (viewshed). Next, all sharing
the visibility primitive:

- `fields.py` — field-of-fire score, exposure / concealment map, dead ground
- `routes.py` — least-cost approach paths (slope + traversability + exposure)

Keep outputs operator-actionable: a ranked answer + a clear visual, in UTM grid
references, in < 10 s.
````

## File: src/frontend/src/components/Sidebar.tsx
````typescript
import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { ColorMode, LayerKey } from '../lib/types'
⋮----
export default function Sidebar()
⋮----
onChange=
````

## File: src/frontend/src/components/ThreatPopup.tsx
````typescript
import { useStore } from '../lib/store'
import { ThreatType } from '../lib/types'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
````

## File: src/frontend/src/lib/colors.ts
````typescript
// Object class → fill colour (tactical palette lives in tailwind.config.js).
⋮----
// Google Turbo colormap, t in [0,1] → [r,g,b] in [0,1].
export const TURBO = (t: number): [number, number, number] =>
⋮----
const c = (x: number)
````

## File: src/frontend/src/lib/utils.ts
````typescript
type V3 = [number, number, number]
⋮----
// World (UTM E, N, elev) → view space, recentred on the scene and y-up.
export function w2v(p: V3, origin: V3, span: V3): V3
⋮----
// View space → World (UTM E, N, elev), inverse of w2v().
export function v2w(p: V3, origin: V3, span: V3): V3
````

## File: src/config.json
````json
{
  "backend": { "host": "127.0.0.1", "port": 8011 },
  "frontend": { "port": 5173 },
  "cloud": { "voxel_m": 0.1, "max_points": 3900000 },
  "fires": { "exposure_shots": 1 }
}
````

## File: docs/architecture.md
````markdown
# Architecture

Tactical-reasoning layer on top of SE3 Labs' georeferenced 3D battlefield
reconstruction (EDTH Munich challenge). The system turns geometry into operator
judgments: where the enemy can observe, where friendly movement is exposed, what
ground is dead, how lethal each cell is, and which placed soldiers are in danger
right now.

## One-Line System

Provided 3D data -> FastAPI backend packs the point cloud and serves API data ->
React/Vite tactical viewer renders a three.js scene -> operator marks the enemy
(type + heading + intel confidence; the laydown is operator ground truth, not
auto-templated) -> backend **auto-projects** the fires/observation fields the
moment the laydown changes (no "analyse" button) and serves per-point overlays ->
the viewer warns when a placed friendly soldier is exposed.

## Components

| Component | What it is | State |
|-----------|------------|-------|
| **Data** (`data/`) | Provided point cloud and object boxes, gitignored | given |
| **Backend API** (`src/backend/app.py`) | FastAPI app that packs the cloud on startup, serves `api/*`, holds an in-memory unit-contact store, runs `threat/recompute` | built |
| **Tactical layer** (`terrain.py`, `visibility.py`, `units.py`, `threat_template.py`, `fields.py`) | DSM + box occluders, radial LOS viewshed, doctrinal unit catalog (weapon realism), operator laydown, per-target-class fires/observation projection | built |
| **Frontend** (`src/frontend/`) | React 18 + Vite + Tailwind UI; imperative three.js engine; 3D unit GLB models + NATO symbols; drag-to-place/move/remove; risk/crossfire/lethality overlays; danger alert | built |
| **Generated analysis** (`build/`) | `dsm.tif`, `viewshed.{tif,bin,json}`, `threat.json`, `fields_cost_{dismount,light_veh,armour}.tif`, `fields_depth.tif`, per-class `{danger,pfatal,depth,reason,conf,suppress}_<class>.bin`, `fields.json` | generated, gitignored |

## Data Foundation

Two inputs share the same UTM metre frame and register directly, with no
alignment step.

- **`point_cloud.ply`**: binary little-endian PLY, single `vertex`, about
  **3,986,862 points**. Each point has `double x,y,z` in UTM/elevation plus
  `uchar red,green,blue` from photo texture, not class labels. Scene span is
  about **1264 x 775 m**, relief about **32 m**, density about **4 pts/m2**.
  This supports 2.5D surface reasoning, not volumetric interior reasoning.
- **`bounding_boxes.json`**: **58 oriented 3D boxes** for man-made objects only:
  shelter 19, house 15, container 16, wall 7, car 1. Each box has `center`,
  `extent`, yaw quaternion in `rotation`, and `avg_temperature`. Boxes are hard
  cover / LOS occluders; thermal values can cue possible occupancy.

## Runtime Data Flow

```text
data/point_cloud.ply
  -> io.read_ply() zero-copy memmap
  -> app.pack_cloud() voxel-downsample + recenter + sub-voxel horizontal jitter + RAM
  -> /api/meta + /api/cloud

data/bounding_boxes.json
  -> /api/boxes

terrain pass (cached per resolution by terrain_for()):
  point cloud + boxes
    -> terrain.build_dsm() -> build/dsm.tif (max-height grid + box occluders)
    -> visibility.py -> build/viewshed.{tif,bin,json}     (one-off, optional)
    -> /api/viewshed(+info)  |  POST /api/viewshed recomputes LOS at a cursor

operator session (in-memory unit store, cleared on reset/restart):
  operator places units (POST /api/units, hostile + friendly; 8 types, heading,
                         intel confidence) and can PATCH (move/reorient) or DELETE them
    -> /api/units (list, side-filtered) + /api/unit-profiles (catalog)
    -> the frontend AUTO-fires POST /api/threat/recompute on every laydown change
       (debounced, single-flight) — no explicit "analyse" step
         -> threat_template.from_manual() -> build/threat.json (laydown)
         -> fields.run() -> per-class build/{danger,pfatal,depth,reason,conf,suppress}_<class>.bin
                          + fields_cost_<class>.tif + fields_depth.tif + fields.json
    -> /api/threat-info · /api/{danger,pfatal,depth,reason,conf,suppress}?class=
       · /api/fields-info
    -> POST /api/threat/reset wipes the laydown + projected artifacts (blank field)

browser:
  React app -> Zustand store -> SceneCanvas -> Viewer.ts three.js engine
  HUD modes: rgb · height (base) | risk · depth (crossfire) · pfatal (analysis surfaces)
  "risk for" toggle picks the target class (Infantry/Light veh/Armour) the surface shows
  DangerAlert banner reads fields.json `soldiers` and warns on exposed friendlies;
  "locate" flies the camera (store.focusWorld -> Viewer.focusWorld) to the soldier
```

## Coordinate Handling

UTM doubles exceed float32 precision in the browser. The backend stores served
positions relative to the local minimum corner in `pack_cloud()` and exposes the
origin/span through `/api/meta`. The viewer maps world coordinates through
`w2v(E,N,U)` (and the inverse `v2w`, used for placement picking): east -> X,
elevation -> Y/up, north -> -Z, then recenters by scene span. Scale is true 1:1
with no vertical exaggeration.

Cloud serving resolution is controlled by `src/config.json`:
`cloud.voxel_m = 0.1` and `cloud.max_points = 3900000` by default. To break the
DSM lattice moiré, served points get sub-voxel horizontal jitter (z untouched).
`config.json` also carries `fires.exposure_shots` (the cumulative-exposure
multiplier read by `fields.py`).

## Tactical Layer

The spine is **viewshed**, because observation gates lethality. The chain is:

```text
terrain.py        DSM from cloud + 58 boxes stamped as solid occluders   [built]
visibility.py     vectorized radial LOS; range, arc, facing, eye/target h [built]
units.py          doctrinal unit catalog + weapon realism (single source) [built]
threat_template   operator-placed enemies -> build/threat.json laydown    [built]
fields.py         per-target-class fires/observation projection           [built]
routes.py         least-cost approach, covered axis, GO/NO-GO             [planned]
landcover.py      vegetation/concealment mask (separate from hard cover)  [planned]
```

**`units.py`** is the single source of truth for per-type properties, read by the
analysis chain (`threat_template`, `fields`) and the frontend (`GET
/api/unit-profiles`); no side keeps a duplicate. The `UNIT_CATALOG` covers **eight
types** — `tank`, `ifv`, `apc`, `assault`, `sniper`, `mortar`, `at_team`,
`atgm_team` (plus the legacy `sniper_op` alias -> `sniper`). The weapon-realism
model per type:

- **Two arcs**: `obs_arc` (wide OBSERVATION sector — "can they detect me?") and
  `weapon_arc` (narrow LETHAL sector of fire on the heading — "can they kill me
  here now?"). LOS is traced once at the wide obs arc, then masked to the weapon
  arc for lethality.
- **Hill `p_hit` curve** `ph_p0 / (1 + (d/d50)^ph_beta)` with `d50 = ph_shoulder *
  eff_range_m`; lethality decays with range instead of a hard edge. `min/eff/max`
  range bound the engagement annulus (`min_range_m` = mortar/ATGM dead zone).
- **Per-target-class effectiveness** `eff{dismount, light_veh, armour}` = P(kill |
  hit): a rifle is lethal to dismounts but ~0 vs armour, so the same laydown
  threatens each class differently.
- **Suppression** `supp_s0` (MG beaten-zone plateau; 0 for precision weapons).
- `TargetClass` enum + `TARGET_HEIGHT_M` (dismount 1.7 m; light_veh/armour 2.5 m)
  drive which of the two viewshed heights a class is evaluated at.

`UnitContact` is a placed instance (position + intel `confidence` + `azimuth` +
`source`); `PlaceUnitRequest`/`UpdateUnitRequest` are the POST/PATCH bodies.

**`threat_template.py`** does *not* auto-template enemy positions — the operator
marks where the enemy actually is. `from_manual()` turns the placed enemies into
`build/threat.json`, converting each operator heading (compass azimuth) into a
viewshed facing (`facing_deg = 90 - azimuth`); indirect units get no sector of
fire. Friendly positions become the laydown's `avenue` points and set
`avenue_source = 'operator'` — the gate the frontend uses before revealing any
threat.

**`fields.py`** `run()` projects the laydown **per target class**:

- Each direct-fire shooter's observation viewshed (memoised in a per-shooter
  content-keyed cache, so editing one unit re-sweeps one unit) is masked to its
  weapon arc + range band; `P(kill) = visible × p_hit × eff[class]`, combined as a
  probabilistic union over shooters with the per-contact intel `confidence` and
  the `exposure_shots` multiplier folded in.
- **Engagement depth** = a count of overlapping killing weapons per cell (>=2 = a
  mutually-supporting kill zone / crossfire).
- **Indirect fire** = the mortar range annulus AND (observed by any eyes OR a
  pre-registered TRP on a terrain-forced chokepoint, found via a clearance
  medial-axis on the passable mask).
- **Cover** (boxes stop rounds) reduces the continuous routing `cost`.
- Separate from `cost`, **`pfatal`** is a true marginal P(lethal enemy fire) —
  the independent union of direct + indirect lethal hits, each weighted by P(kill
  | hit) and P(enemy actually placed here), with no cover credit or kill-zone
  emphasis.
- **`reason`** classifies why a cell is (un)safe: 0 out-of-range, 1 dead-ground,
  2 cover, 3 exposed. **`conf`** is the intel confidence the cell is threatened;
  **`suppress`** is the beaten-zone field.
- **Per-soldier exposure**: each placed friendly (`threat.json` avenue point) is
  classified into a risk zone (`kill_zone` / `high` / `moderate` / `low`) on the
  dismount surface and written to `fields.json` `soldiers`, which drives the
  DangerAlert banner.

Outputs are both georeferenced GeoTIFFs (GIS reuse) and per-point `.bin` overlays
aligned to the exact packed cloud FastAPI serves. The class-suffixed surface
endpoints (`/api/danger`, `/pfatal`, `/depth`, `/reason`, `/conf`, `/suppress`)
take `?class=` (default `dismount`).

## Frontend

The engine (`Viewer.ts`) owns the imperative three.js world; React components only
read/write the Zustand store, and `SceneCanvas` forwards store -> engine via
effects.

- **3D models + symbology**: placed units render as **GLB models**
  (`public/assets/<type>.glb`, loaded with `GLTFLoader` + `MeshoptDecoder`) under
  scene lighting (hemisphere + directional sun); NATO symbols are drawn with
  `milsymbol`.
- **Placement**: drag-to-place (drag to orient enemy heading), drag-to-move, and
  remove are mutually-exclusive map modes; ESC cancels.
- **Overlays**: `risk` (banded classification via `riskBand()`), `depth`
  (crossfire indicator), and `pfatal` (probability of lethal fire) read the
  per-class `.bin` arrays, re-fetched on the "risk for" class toggle; these
  surfaces auto-blend onto the RGB photo.
- **Auto-project + alert**: `SceneCanvas` debounces a single-flight
  `recompute` on every laydown change (the `AnalyzingSpinner` pill is the only
  visible signal); `DangerAlert` tiers exposed soldiers and "locate" flies the
  camera to them via `focusWorld`.

## Honest Limits

- Point cloud density and top-down capture enable surface-accurate 2.5D
  visibility over roofs, walls, canopy, and terrain, not see-through-wall or
  building-interior inference.
- The DSM treats tree canopy as a solid occluder, so dead ground behind
  vegetation is really *concealment* (hides you, doesn't stop a round). Until
  `landcover.py` exists this is tagged lower-confidence, not fully safe.
- Engagement envelopes are doctrinal models (Hill `p_hit`, per-class `eff`), not
  ballistic simulation.
- Red positions come from operator placement, not detection; `fields.py`
  projects what is marked, it does not discover the enemy. Per-contact intel
  confidence is carried through to the surfaces rather than implied.
- The unit-contact store is in-memory and resets on server restart; the laydown
  is per-session and cleared by `/api/threat/reset` or on lifespan startup.
- With one temporal pass there is no change detection or live movement tracking.
````

## File: docs/conventions.md
````markdown
# Conventions

## Stack

- **Python >= 3.12**, managed by **uv**. Package root is `src`; build backend is hatchling.
- Backend dependencies: `numpy`, `fastapi`, `uvicorn[standard]`, `rasterio`, `shapely`, `scipy`, `pydantic`.
- **Backend:** FastAPI in `src/backend/app.py`; tactical analysis modules (`terrain`, `visibility`, `units`, `threat_template`, `fields`) in `src/backend/`.
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + three.js + Zustand under `src/frontend/`.
- Shared runtime config is `src/config.json`: backend host/port, frontend port, and cloud voxel/max-point settings.

## Python Style

- Ruff is the configured formatter/linter: line length 135, target `py312`, Black-compatible format.
- Ruff lint select: `E F I B C4 TCH SIM ANN ARG RUF`; ignored: `RUF100`, `B904`.
- isort order: future, standard-library, third-party, first-party, local-folder; force-sort within sections.
- Type hints are expected. Scripts use module docstrings with usage examples, `argparse`, and a `main()` entrypoint.
- Data-heavy code is numpy-first and favors vectorized operations, memmaps, deterministic sampling (`np.random.default_rng(seed)`), and avoiding unnecessary copies.
- Cross-module imports inside the backend use `sys.path.insert(0, ROOT)` + `from src.backend.x import ...` (see `fields.py`, `threat_template.py`).
- Comments should be terse and explain why, especially around coordinate precision, geospatial transforms, and LOS/threat assumptions.

## Frontend Style

- TypeScript is strict: `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled.
- React owns UI state and layout; `Viewer.ts` owns the three.js scene graph imperatively. Do not let React mutate three.js objects directly.
- Use Zustand store state/actions for viewer metadata, boxes, viewshed/threat/fields readiness, units list, unit profiles, layers, color mode, overlay-on-rgb, selection, placing/removing modes, active side/unit type, loading, and error state.
- Tailwind is the styling system. Tactical color tokens live in `tailwind.config.js`; reusable component utilities (`.panel`, `.hud-text`, `.eyebrow`, `.skeleton-bar`, `.skip-link`) are in `src/index.css`.
- Frontend API calls should use relative `/api/...` URLs so Vite proxy works in dev and same-origin works in production.
- Static Tailwind class strings only — the JIT cannot see interpolated class names (see `FriendlyPanel.tsx`'s `activeBtn`/`idleBtn` pattern).

## Naming And Coordinates

- Python files/functions use `snake_case`; TypeScript components use `PascalCase`; frontend helpers/types use idiomatic TS naming.
- Box class labels are `car | container | wall | house | shelter`.
- Doctrinal unit types (`UNIT_CATALOG` keys): `tank | ifv | apc | assault | sniper | mortar | at_team | atgm_team`. Legacy alias `sniper_op` resolves to `sniper`.
- `Side`: `friendly | hostile | unknown`. `FireKind`: `direct | indirect | observer`. `ThreatRole`: `observer | anti_armor | indirect`.
- OPFOR conceptual labels in docs include `sniper | tank | atgm | ifv | mortar | howitzer | mlrs | uav_recon | ew`.
- Coordinates are UTM metres. Browser view frame is east -> X, elevation -> Y/up, north -> -Z.
- Outputs should prefer UTM/MGRS grid references and metres because operator-facing decisions are grid-based.

## Single Source Of Truth Discipline

- `units.UNIT_CATALOG` is the single source of truth for per-type unit properties. The analysis chain (`threat_template`, `fields`) and the frontend (`GET /api/unit-profiles`) both read from it; neither side keeps a hand-maintained duplicate.
- `types.ts` mirrors the backend pydantic models (`UnitProfile`/`UnitContact`/`PlaceUnitRequest` mirror `units.py`). Keep them in sync when the backend model changes.

## Data Discipline

- Never commit provided data or generated analysis: `data/*.{ply,json,pcd,las,laz,bag}`, `build/`, rendered figures, screenshots, and frontend build/cache outputs are ignored.
- Verify dataset claims by parsing files, not by trusting descriptions. Use `inspect_ply.py` and documented stats in `docs/data.md`.
- `.docs/repo-context.md` is generated by repomix. Do not hand-edit it.
- Repomix output may include generated cache files if they are present and not ignored; do not treat `src/frontend/.vite/` or stale `docs/repo-context.md` as source.

## Git / Workflow

- Work on feature branches off `main`.
- Agents must not commit, push, or amend unless the user explicitly asks.
- Dependabot is configured for weekly pip updates, grouped.

## Information Panel Popup

Any popup that surfaces details for a scene object uses `InfoPanelPopup` (`src/frontend/src/components/InfoPanelPopup.tsx`).

**Contract:**
- `screen: ScreenPoint | null` — projected screen position of the anchor world coordinate. The Viewer's render loop calls `emitCursorScreen()` each frame, which projects `cursorAnchor` (a UTM world coord) into screen space and pushes the result into `store.selectedCursor.screen`. This makes the popup follow the object as the camera moves, unlike a raw click-position which would drift.
- `header` — ReactNode rendered alongside the close button.
- `onClose` — clears the relevant store selection (`select(null)`, `selectThreat(null)`, `selectUnit(null)`).
- `children` — detail rows, typically using the exported `DataRow` component.

**Wiring a new popup:**
1. Store action sets `selectedCursor: { screen: clickPos, world: utmCoord }` and the relevant selection field.
2. Viewer calls `setCursorAnchor(world)` (via `SceneCanvas` effect) so the render loop tracks it.
3. The popup component reads `selectedCursor.screen` for position and its own selection slice for content.
4. Wrap with `InfoPanelPopup` — no bespoke position arithmetic needed.

**Existing consumers:** `ObjectPopup` (bounding boxes), `ThreatPopup` (analyzed threat positions), `PlacedUnitPopup` (operator-placed enemies and friendlies).

## Testing And Checks

- No comprehensive automated test suite is present yet.
- Backend sanity checks: `uv run python src/backend/scripts/inspect_ply.py` and `uv run python src/backend/visibility.py` when data is available.
- Threat pipeline regen: `uv run python src/backend/fields.py` (or `POST /api/threat/recompute` at runtime after placing units).
- Frontend build check: `npm --prefix src/frontend run build`.
- Keep tactical outputs operator-actionable in under 10 seconds and be explicit about model/data limits.
````

## File: docs/current-focus.md
````markdown
# Current Focus

## Where We Are

The operator-driven threat-projection product is built end to end: the FastAPI backend, the
viewshed primitive, the React/three.js viewer, manual enemy/friendly placement, and the full
fires/observation projection with per-target-class risk surfaces. The operator marks the
enemy from intel (no auto-templating) and the system projects what they threaten.

- [x] Data ingest and inspection: `io.py`, `inspect_ply.py`.
- [x] FastAPI backend: packs the cloud on startup, serves `/api/{meta,cloud,boxes}`, optional viewshed endpoints, the unit/threat/fields endpoints, and per-class overlay bins.
- [x] React/Vite tactical viewer: point cloud, semantic boxes, color modes, layer toggles, selected-object inspection, keyboard navigation, true 1:1 scale, operator unit placement, and analyzed-laydown overlays.
- [x] Slice 1 viewshed: `terrain.py` builds the DSM and stamps 58 box occluders; `visibility.py` computes radial LOS (vectorized numpy sweep) and writes `build/viewshed.*`.
- [x] **Doctrinal unit catalog** (`units.py`): single source of truth for **8 unit types** — tank / ifv / apc / assault / sniper / mortar / **at_team** (RPG) / **atgm_team** (Javelin) — each a sensor envelope (`obs_arc`, `obs_range`) plus a default weapon (range, two arcs, fire kind, per-target-class effectiveness `eff`). Served via `GET /api/unit-profiles`.
- [x] **Operator-placed enemy laydown** (`threat_template.py`): operator marks where the enemy is; `POST /api/threat/recompute` turns marks into `build/threat.json`. No auto-templating.
- [x] **Unit & weapon realism** (`units.py` + `fields.py`): sourced ranges (mortar dead-zone annulus, AT/ATGM brackets), **two arcs** per unit (wide observation arc vs narrow weapon/engagement arc), a **Hill hit-probability curve** (replacing the flat-linear `p_hit`), and **weapon→target-class effectiveness** so the same laydown yields a different surface per "who's moving."
- [x] **Risk foundation** (`fields.py`): per-target-class danger / depth / suppress / reason / conf bins, sampled like `danger.bin`; per-class endpoints via `?class=`.
- [x] **`P(fatal)` surface** (`fields.py`): independent-union probability-of-lethal-enemy-fire (direct + indirect), emitted as `pfatal_<class>.bin` and served at `/api/pfatal`.
- [x] **Three HUD analysis surfaces** (`Hud.tsx` / `Viewer.ts`): **Risk Classification** (banded zones), **Crossfire Indicator** (engagement-area depth), **Probability of Lethal Fire** (`P(fatal)`), with a **"risk to: dismount / light / armour"** target-class toggle.
- [x] **Auto-project on placement**: the laydown re-projects on change without a page reload (no more manual full-page reload after Analyse).
- [x] **Soldier danger-alert** (`DangerAlert.tsx`): tiered notification when a placed friendly is exposed, with a camera **"locate" fly-to**.
- [x] **Unit move mode** (`store.moving`) and **3D unit models** rendered on the tactical surface.
- [x] Interactive viewshed at cursor: `POST /api/viewshed` recomputes LOS at a clicked point.

## Active Work

- UI/UX refit toward a tactical C2 design philosophy (glance-first, honest uncertainty,
  semantic color, redundant shape/text encoding, spatial constancy, explicit
  degraded/missing-data states, no hover-only critical controls). Sidebar polish, decluttered
  HUD, class icons, and a larger risk legend have landed; this continues.
- The battlefield opens blank (terrain + object boxes only); the operator places the enemy,
  then analysis projects automatically. `POST /api/threat/reset` and lifespan startup wipe the
  laydown + projected artifacts via `clear_laydown()`.

## Next In Order

Per the roadmap in [ANALYSIS_LAYER.md](ANALYSIS_LAYER.md):

1. **`routes.py`** — covered approach / least-cost path over the danger raster we already
   build (covered axis, bounds, chokepoints, dead ground, suppression priority, GO/NO-GO).
   The headline "how do I get there alive." Wants the per-shooter viewshed stack and
   friendly-side fields as enablers. See [MANEUVER_ANALYSIS.md](MANEUVER_ANALYSIS.md).
2. **Objective lens** — operator picks a mission objective (move / seize / control / destroy /
   defend / clear / raid) → reweight + surface over one common substrate. Needs friendly-side
   fields ("what can WE see/shoot").
3. **`landcover.py`** — vegetation→concealment mask + bare-earth DTM, fixing the
   canopy-as-opaque-cover issue and unblocking slope/trafficability for routes.
4. **Tablet Q&A** — LLM tool-calling over the spatial primitives ("ask the battlefield").

## Open Questions

- What exactly counts as an operator-good output in under 10 seconds? This gates risk weights
  and what the UI should escalate.
- What confidence vocabulary should be standardized across operator-placed positions, thermal
  cues, and stale viewshed/fields products? (`confidence` is collected but partly dropped.)
- Should the indirect-fire model grow beyond mortar range ∩ (observed ∪ TRP) — e.g.
  time-of-flight, ammo resupply, or counter-battery risk?
- Persistence: the unit-contact store is in-memory and resets on server restart — decide
  whether session persistence or a snapshot is needed.

## Notes

- Single-pass thermal cueing remains valuable: warm structures from `avg_temperature` can
  raise suspected OP/weapon likelihood without claiming confirmation (currently display-only).
- Generated `build/` layers are absent until scripts/endpoints run; the UI represents this as
  unavailable/degraded data, not as an empty or silently disabled state.
- `fields.py` recomputes the DSM internally via `build_dsm()`; `app.py` caches terrain by
  `res_m` in `TERRAIN` but `fields.run()` does not yet reuse that cache (a known speed-up TODO).
````

## File: docs/module-map.md
````markdown
# Module Map

```text
.
├── data/                         provided inputs, gitignored
├── build/                        generated layers (DSM, viewshed, threat, fields), gitignored
├── src/
│   ├── backend/                  Python IO, FastAPI, tactical analysis
│   │   ├── app.py                API server, cloud packer, unit store, threat recompute
│   │   ├── io.py                 zero-copy PLY reader
│   │   ├── terrain.py            DSM + box occluders
│   │   ├── visibility.py         vectorized radial LOS viewshed
│   │   ├── units.py              doctrinal unit catalog + weapon realism (single source of truth)
│   │   ├── threat_template.py    operator-placed enemies -> build/threat.json laydown
│   │   ├── fields.py             per-target-class fires/observation projection
│   │   ├── README.md             backend notes and roadmap
│   │   └── scripts/
│   │       └── inspect_ply.py    data sanity-check CLI
│   ├── frontend/                 React/Vite/three.js tactical UI
│   │   ├── public/
│   │   │   └── assets/           unit GLB models (tank, ifv, apc, assault, sniper, mortar, at_team, atgm_team)
│   │   ├── src/
│   │   │   ├── components/       HUD, panels, popups, alert, spinner, canvas mount
│   │   │   ├── engine/           imperative three.js viewer
│   │   │   ├── lib/              API, store, types, colors, utils
│   │   │   ├── App.tsx           root layout
│   │   │   ├── index.css         Tailwind layers/component classes
│   │   │   └── main.tsx          React entrypoint
│   │   ├── index.html            Vite HTML shell
│   │   ├── package.json          npm scripts/deps (three, milsymbol, lucide-react, zustand)
│   │   ├── tailwind.config.js    tactical color tokens
│   │   └── vite.config.ts        Vite + API proxy config
│   └── config.json               shared backend/frontend ports + cloud + fires settings
├── docs/                         project/domain docs
├── .docs/                        agent context summaries + generated repomix dump
├── pyproject.toml                Python package/deps/ruff config
└── run.sh                        starts backend and frontend dev servers
```

## Backend — `src/backend/`

| File | Responsibility |
|------|----------------|
| `io.py` | **Zero-copy PLY reader.** `read_ply(path)` memory-maps binary little-endian PLY vertex data into a numpy structured array. The dtype is built from the header, so added properties are picked up automatically. |
| `app.py` | **FastAPI server.** On startup `pack_cloud()` voxel-downsamples the PLY, recenters to local origin, adds sub-voxel horizontal jitter, and stores packed bytes in RAM; lifespan also `clear_laydown()`s so each session starts blank. Holds an in-memory `UNITS` contact store. Endpoints below. Reads shared settings from `src/config.json`; CORS for the Vite dev server. |
| `terrain.py` | **DSM builder.** `build_dsm()` creates a max-height grid from the cloud, rasterizes the 58 oriented boxes as solid occluders, nearest-fills gaps, and returns the DSM + transform + bounds + EPSG (caches `build/dsm.tif`). Helpers: `box_yaw`, `box_polygon`, `world_to_pixel`, `save_geotiff`. |
| `visibility.py` | **Viewshed engine.** `viewshed()` computes vectorized radial line-of-sight from an observer on the DSM using range, arc, facing, eye height, target height. Auto-places the default observer on a roof edge. Writes `build/viewshed.{tif,bin,json}` for the optional LOS overlay. |
| `units.py` | **Doctrinal unit catalog + weapon realism.** `Unit` (static type def) + `UnitContact` (placed instance) + `PlaceUnitRequest`/`UpdateUnitRequest` (POST/PATCH bodies). `UNIT_CATALOG` covers 8 types (tank/ifv/apc/assault/sniper/mortar/at_team/atgm_team) with `weight_class`, `role`, `fire_kind`, **`obs_arc` (observation) + `weapon_arc` (lethal sector)**, eff/max/min range, **Hill `p_hit` params (`ph_p0`/`ph_shoulder`/`ph_beta`)**, suppression `supp_s0`, and **per-target-class `eff{dismount,light_veh,armour}`** (P(kill\|hit)). Adds the `TargetClass` enum + `TARGET_HEIGHT_M`. `resolve_unit()` handles the legacy `sniper_op` alias; `unit_profiles()` feeds `GET /api/unit-profiles`. Single source of truth for both the analysis chain and the frontend. |
| `threat_template.py` | **Enemy laydown builder.** `from_manual(enemies, friendly)` turns operator-placed enemies into `build/threat.json`, converting each operator heading to a viewshed facing (`facing_deg = 90 - azimuth`); indirect units get no sector of fire. Friendlies become the `avenue` points and set `avenue_source = 'operator'` (the frontend's reveal gate). Per-type arc/role come from the unit catalog. Not auto-templated — operator provides ground truth. |
| `fields.py` | **Per-target-class fires/observation projection.** `run(side, res)` reads `build/threat.json` and projects, for each of dismount/light_veh/armour: direct-fire `P(kill)` (viewshed once at the obs arc, masked to the weapon arc; Hill `p_hit` × `eff[class]`, union over shooters with intel confidence + `exposure_shots`), **engagement depth** (crossfire, >=2 overlap), **indirect** (mortar annulus ∩ observed/TRP), continuous routing **danger** cost (cover-credited), true **pfatal** (marginal P(lethal fire)), **reason** (0 out-of-range / 1 dead-ground / 2 cover / 3 exposed), **conf**, **suppress**, and **per-soldier exposure zones**. Uses a per-shooter viewshed cache + the API's DSM/cloud caches. Writes `fields_cost_<class>.tif`, `fields_depth.tif`, per-class `{danger,pfatal,depth,reason,conf,suppress}_<class>.bin`, and `fields.json`. |
| `scripts/inspect_ply.py` | Prints PLY header, axis stats, color uniqueness sample, and elevation percentiles for sanity checks. |

### API endpoints (`app.py`)

| Method · Path | Purpose |
|---------------|---------|
| `GET /api/meta` · `GET /api/cloud` · `GET /api/boxes` | cloud metadata, packed point bytes, object boxes |
| `GET /api/viewshed` · `POST /api/viewshed` · `GET /api/viewshed-info` | precomputed LOS bin / recompute at a cursor / params |
| `GET /api/threat` · `GET /api/threat-info` | laydown bin / `threat.json` |
| `GET /api/danger` · `/pfatal` · `/depth` · `/reason` · `/conf` · `/suppress` | per-point analysis surfaces; each takes `?class=` (dismount\|light_veh\|armour, default dismount) |
| `GET /api/fields-info` | `fields.json` (shooter count, depth, TRPs, exposure stats, `soldiers`, per_class) |
| `GET /api/units?side=` · `GET /api/unit-profiles` | contact store (side-filtered) / doctrinal catalog |
| `POST /api/units` · `PATCH /api/units/{id}` · `DELETE /api/units/{id}` · `DELETE /api/units?side=` | place / move-reorient / delete / clear units |
| `POST /api/threat/recompute` · `POST /api/threat/reset` | build laydown + project fields / wipe back to blank |

Planned backend modules still live conceptually after `fields.py`: `routes.py`
for least-cost maneuver outputs and `landcover.py` for a vegetation/concealment
mask separate from hard cover.

## Frontend — `src/frontend/`

| File | Responsibility |
|------|----------------|
| `src/App.tsx` | Root full-screen tactical layout. Renders `SceneCanvas`, `Hud`, `FriendlyPanel`, `DangerAlert`, `AnalyzingSpinner`, `ObjectPopup`, `ThreatPanel`, `ThreatPopup`, `PlacedUnitPopup`, and loading/error overlays. |
| `src/components/SceneCanvas.tsx` | Mounts the three.js engine once and forwards Zustand store changes into it. **Auto-projects** the fields on every laydown change (debounced, single-flight `postRecompute`), polls `/api/units` every 2 s to pick up API-side changes, runs the cursor-LOS POST in viewshed mode, and handles ESC to cancel place/move/remove. |
| `src/components/Hud.tsx` | Top-left panel: base map modes (RGB / Height) + **Battlefield Analysis** surfaces (**Risk Classification** = `risk`, **Crossfire Indicator** = `depth`, **Probability of Lethal Fire** = `pfatal`, gated on `fieldsReady`); a **"risk for"** target-class toggle (Infantry/Light veh/Armour); the risk-band legend (matches `riskBand()`); and the object-class legend with Lucide icons + counts. |
| `src/components/FriendlyPanel.tsx` | Operator unit controls (top-right): ENEMY/ALLY side toggle, place/**move**/remove map modes, unit-type picker (from `/api/unit-profiles`), viewfields toggle, and "clear all" (`postReset` + `clearUnits`, then reload). No "analyse" button — projection is automatic. |
| `src/components/DangerAlert.tsx` | Tiered per-soldier danger banner (red `kill_zone` / orange `high` / yellow `moderate`) read from `fields.json` `soldiers`; expandable per-tier list with a "locate" control that flies the camera via `focusWorld`. |
| `src/components/AnalyzingSpinner.tsx` | Top-centre "Analysing threat" pill, shown while `scanning` (the only visible signal of the auto-recompute). |
| `src/components/ThreatPanel.tsx` | Ranked list of likely enemy positions from `/api/threat-info`, visible only in the `threat` color mode. |
| `src/components/InfoPanelPopup.tsx` | Generic anchor-following popup wrapper: tracks `selectedCursor.screen` (projected each frame) so the popup follows its subject as the camera moves. Exposes `DataRow`. |
| `src/components/ObjectPopup.tsx` | Bounding-box detail popup (uses `InfoPanelPopup`). |
| `src/components/ThreatPopup.tsx` | Analyzed threat position popup. |
| `src/components/PlacedUnitPopup.tsx` | Operator-placed enemy/friendly unit popup. |
| `src/components/Sidebar.tsx` | Legacy/unused — not imported anywhere in the current app. |
| `src/engine/Viewer.ts` | Imperative three.js world. Owns renderer, scene graph + lighting (hemisphere + directional sun), OrbitControls, point cloud, semantic boxes, **3D unit GLB models** (`GLTFLoader` + `MeshoptDecoder`) and **NATO symbols** (`milsymbol`), range rings, drag-to-place/move/remove, selection, layer visibility, `focusWorld()` camera fly-to, cursor-screen projection, and color-mode switching (rgb/height/temperature/viewshed/threat/depth/pfatal/risk). Holds per-target-class risk arrays (danger byte, depth, reason), re-fetched on `setRiskClass`, and bands them via `riskBand()`. |
| `src/lib/api.ts` | Typed fetch helpers. Relative URLs (Vite proxy in dev, same-origin in prod). Covers units CRUD + PATCH, recompute/reset, viewshed, and the per-class surface bins (`?class=`). |
| `src/lib/store.ts` | Zustand app state: metadata, boxes, viewshed/threat/fields info + readiness flags, color mode, `riskClass`, overlay-on-rgb, layers, class visibility, selections, placing/**moving**/removing modes, active side/unit type, units list, unit profiles, `scanning`, and `focusWorld` (set by SceneCanvas). Async actions: place/move/reorient/remove/clear units. |
| `src/lib/types.ts` | Shared TS interfaces mirroring the backend: `CloudMeta`, `BoundingBox`, `ViewshedInfo`, `UnitProfile`/`UnitContact`/`PlaceUnitRequest` (mirror of `units.py`), `ThreatInfo`/`ThreatPosition`, `FieldsInfo` with `SoldierExposure`/`RiskZone`, plus `ColorMode`/`LayerKey`/class-visibility types. |
| `src/lib/colors.ts` | Object-class colors (`CLASS_COLORS`) + the Google Turbo colormap (`TURBO`). Tactical palette tokens live in Tailwind config. |
| `src/lib/utils.ts` | `w2v()` / `v2w()` coordinate mapping between UTM world space and viewer space. |
| `src/index.css` | Tailwind base/components. Defines `.panel`, `.hud-text`, `.eyebrow`, `.skeleton-bar`, `.skip-link`, segmented/legend cell styles. |

## Data — `data/`

Expected files are `point_cloud.ply` and `bounding_boxes.json`. They are large or
sensitive and gitignored. `data/README.md` documents the drop-in requirement.

## Docs — `docs/`

| File | Content |
|------|---------|
| `challange.md` | EDTH/SE3 challenge brief and chosen Track 1 direction. |
| `data.md` | Parsed dataset facts and implications. |
| `ANALYSIS_LAYER.md` | Analysis-engine + unit/weapon-realism design notes (referenced by `units.py`/`fields.py`). |
| `THREAT_LIBRARY.md` | OPFOR asset model, sensor/weapon envelopes (partially stale — see `CLAUDE.md`). |
| `MANEUVER_ANALYSIS.md` | Blue COA concept: O/D/I/C/K/T layers, risk, routes, operator outputs (partially stale). |
| `architecture.md`, `module-map.md`, `conventions.md`, `current-focus.md` | Team/agent context copies under `docs/`; `.docs/` is the injected source of truth. |
| `repo-context.md` | Stale older repomix dump; `.docs/repo-context.md` is the current generated one. |

## Run / Build

- `./run.sh` starts FastAPI through uvicorn and the Vite dev server using ports from `src/config.json`.
- `uv run python src/backend/visibility.py` optionally generates the viewshed overlay consumed by `/api/viewshed*`.
- `uv run python src/backend/fields.py` regenerates the threat fields (also triggered at runtime by `POST /api/threat/recompute`, which the frontend fires automatically).
- `npm --prefix src/frontend run build` runs TypeScript checks and a Vite production build.

`src/frontend/.vite/` appeared in the generated repomix output but is a generated
Vite cache, not source architecture.
````

## File: src/frontend/public/.gitkeep
````

````

## File: src/frontend/src/components/DangerAlert.tsx
````typescript
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { RiskZone, SoldierExposure } from '../lib/types'
⋮----
// red alert   = kill zone (no-go)
// orange warn = high risk
// attention   = moderate (yellow)
type Tier = 'red' | 'orange' | 'yellow'
⋮----
interface Row { exposure: SoldierExposure; label: string }
⋮----
interface BannerProps {
  tier: Tier
  rows: Row[]
  open: boolean
  onToggle: () => void
}
⋮----
// Close on Escape, outside click, or focus loss. Locating a unit does NOT close.
⋮----
const onKey = (e: KeyboardEvent) =>
const onPointer = (e: PointerEvent) =>
⋮----
onToggle=
````

## File: src/frontend/package.json
````json
{
  "name": "se3-tactical-ui",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^1.21.0",
    "milsymbol": "^3.0.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "three": "^0.160.0",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/three": "^0.160.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.6.0",
    "vite": "^5.2.0"
  }
}
````

## File: src/frontend/README.md
````markdown
# SE3 Tactical Intelligence — Frontend

Modern React + Vite application for battlefield intelligence visualization.

## Stack

- **React 18** + **TypeScript** — component framework
- **Vite** — build tool (instant HMR, fast builds)
- **TresJS** → three.js — 3D scene
- **Radix UI** — accessible headless components
- **TailwindCSS** — styling, dark theme
- **Zustand** (ready to add) — global state

## Development

```bash
# Install deps
npm install

# Start dev server (HMR at localhost:5173, proxies /api to :8011)
npm run dev

# Build for production
npm run build

# Preview built app
npm run preview
```

## Architecture

```
src/
├── app/
│   ├── AppContent.tsx    (main layout)
│   └── layout.css
├── components/           (React components)
│   ├── SceneViewer.tsx   (three.js canvas)
│   ├── ControlPanel.tsx  (UI controls)
│   ├── ThreatPanel.tsx   (threat details)
│   └── LayerStack.tsx    (layer toggles)
├── contexts/            (React Context for state)
│   └── ViewerContext.tsx
├── hooks/               (custom hooks)
│   └── useScene.ts      (load scene data)
├── lib/
│   ├── api.ts           (FastAPI fetch calls)
│   ├── types.ts         (TypeScript interfaces)
│   ├── colors.ts        (tactical palette)
│   └── utils.ts         (helpers)
├── App.tsx              (root)
└── main.tsx             (entry)
```

## Features

- **Real-time 3D viewer** — point cloud + semantic boxes, true 1:1 scale
- **Multiple colormodes** — RGB / height / viewshed overlay
- **Layer toggles** — show/hide cloud, boxes, viewshed
- **Threat details** — click boxes to inspect
- **Keyboard shortcuts** — V=viewshed, L=layers, T=threats
- **Dark tactical UI** — command center aesthetic

## Next Steps

- [ ] TresJS integration (Vue wrapper, replace three.js direct calls)
- [ ] Keyboard handler hook (useKeyboard)
- [ ] Threat placement UI
- [ ] Route visualization
- [ ] Risk map heatmap overlay
- [ ] Go/No-Go readout panel

## Env

`VITE_API_URL` — FastAPI base URL (default: localhost:8011)
````

## File: src/frontend/tailwind.config.js
````javascript

````

## File: src/backend/units.py
````python
"""Unit primitives — the shared contact model for all battlefield actors.

A :class:`Unit` is a static doctrinal type definition (sensor/weapon envelope).
A :class:`UnitContact` is a placed instance with position and intelligence quality
fields. :class:`PlaceUnitRequest` is the thin POST body; the backend fills in
doctrinal defaults from :data:`UNIT_CATALOG`.

The catalog is the **single source of truth** for per-type properties. Both the
analysis chain (``threat_template``, ``fields``) and the frontend (via
``GET /api/unit-profiles``) read from it; neither side keeps its own copy.

Realism model (see docs/ANALYSIS_LAYER.md, "Unit & weapon realism"):
  - TWO arcs: ``obs_arc`` = OBSERVATION sector (wide / 360° for alert dismounts &
    scanning snipers; frontal for a buttoned turret) — "can they detect me?". And
    ``weapon_arc`` = the LETHAL sector of fire, centred on the operator's heading
    (the Principal Direction of Fire) — "can they kill me here now?".
  - Range-graded hit probability is a per-weapon Hill curve p0/(1+(d/d50)^beta),
    d50 = ph_shoulder * eff_range_m (see fields.p_hit). beta is the
    accurate-far (high) vs far-but-inaccurate (low) knob.
  - ``eff`` = P(kill | hit) per TARGET CLASS (a rifle ~0 vs armour); the risk
    surface is built per class, so the same laydown threatens infantry, light
    vehicles and armour differently.
  - ``min_range_m`` = inner dead zone (mortar / ATGM arming distance).
"""
⋮----
class Side(str, Enum)
⋮----
friendly = "friendly"
hostile  = "hostile"
unknown  = "unknown"
⋮----
class WeightClass(str, Enum)
⋮----
heavy  = "heavy"
medium = "medium"
light  = "light"
⋮----
class UnitType(str, Enum)
⋮----
tank      = "tank"
ifv       = "ifv"
apc       = "apc"
assault   = "assault"
sniper    = "sniper"
mortar    = "mortar"
at_team   = "at_team"      # dismounted short-range anti-armour (RPG-7 / AT4)
atgm_team = "atgm_team"    # dismounted long-range guided anti-armour (Javelin / Kornet)
⋮----
class FireKind(str, Enum)
⋮----
"""How this unit delivers effect — gates which threat-field pass projects it."""
direct   = "direct"    # line-of-sight weapon (tank, IFV, sniper)
indirect = "indirect"  # indirect fire (mortar/howitzer)
observer = "observer"  # no organic fires; observation only
⋮----
class ThreatRole(str, Enum)
⋮----
"""Tactical role in the IPB fires-and-observation overlay."""
observer   = "observer"
anti_armor = "anti_armor"
indirect   = "indirect"
⋮----
class Source(str, Enum)
⋮----
visual    = "visual"
thermal   = "thermal"
reported  = "reported"
sigint    = "sigint"
templated = "templated"
⋮----
class TargetClass(str, Enum)
⋮----
"""Who is moving through the threat — each sees a different risk surface."""
dismount  = "dismount"     # exposed personnel on foot   (LOS height 1.7 m)
light_veh = "light_veh"    # soft / light vehicle        (LOS height 2.5 m)
armour    = "armour"       # IFV / MBT                   (LOS height 2.5 m)
⋮----
# LOS (target) height per class — drives which viewshed height is used. light_veh and
# armour share 2.5 m so the viewshed is still only ever evaluated at two heights.
TARGET_HEIGHT_M: dict[str, float] = {"dismount": 1.7, "light_veh": 2.5, "armour": 2.5}
⋮----
class UpdateUnitRequest(BaseModel)
⋮----
"""Partial update — only supplied fields are applied."""
azimuth:    float | None = None
world:      tuple[float, float, float] | None = None
confidence: float | None = None
⋮----
class PlaceUnitRequest(BaseModel)
⋮----
"""Thin POST body — backend fills doctrinal defaults from UNIT_CATALOG.

    The operator-side "template" placement is just a :class:`PlaceUnitRequest`
    with only ``side`` + ``unit_type`` + ``world`` + ``azimuth``; the backend
    resolves the catalog entry and returns a fully-populated :class:`UnitContact`.
    """
side:       Side
unit_type:  UnitType
world:      tuple[float, float, float]      # UTM (E, N, elevation_m)
azimuth:    float | None = None             # grid north, clockwise, degrees
velocity:   tuple[float, float] | None = None  # (east_m_s, north_m_s)
confidence: float = 0.5
source:     Source = Source.templated
⋮----
class UnitContact(BaseModel)
⋮----
"""Full contact record — persisted in backend, serialised to frontend as JSON."""
id:                str   = Field(default_factory=lambda: uuid.uuid4().hex[:8])
side:              Side
weight_class:      WeightClass
unit_type:         UnitType
label:             str                        # human-readable type label for the UI
role:              ThreatRole                # tactical role for the fires/observation overlay
fire_kind:         FireKind                  # how the unit delivers effect (gates fields.py projection)
world:             tuple[float, float, float]
confidence:        float
sec_since_contact: float
source:            Source
azimuth:           float | None
obs_arc:           float        # OBSERVATION sector, degrees (detect/react) — wide
weapon_arc:        float        # LETHAL sector of fire, degrees, centred on azimuth — narrow
eff_range_m:       float        # effective engagement range, m
max_range_m:       float        # maximum effective range (p_hit fades to ~0 past it)
min_range_m:       float        # inner dead zone (mortar / ATGM arming distance)
height_agl_m:      float        # sensor/eye height above local terrain (AGL, not sea level)
velocity:          tuple[float, float] | None = None
⋮----
@dataclass
class Unit
⋮----
"""Static type definition — doctrinal sensor/weapon envelope. Not a contact."""
unit_type:    UnitType
weight_class: WeightClass
label:        str
role:         ThreatRole
fire_kind:    FireKind
obs_arc:      float           # OBSERVATION sector, degrees (wide / 360 for alert dismounts)
weapon_arc:   float           # LETHAL sector of fire, degrees (narrow, on the heading)
eff_range_m:  float           # effective engagement range, m
max_range_m:  float           # maximum range
min_range_m:  float           # inner dead zone (0 for most direct weapons)
height_agl_m: float           # sensor/eye height above local terrain
ph_p0:        float           # Hill curve: plateau / point-blank single-shot P(hit)
ph_shoulder:  float           # Hill curve: knee at d50 = ph_shoulder * eff_range_m
ph_beta:      float           # Hill curve: steepness (high = accurate-far-then-cliff)
supp_s0:      float           # suppression plateau (MG beaten zone; 0 for precision weapons)
eff:          dict[str, float]  # P(kill | hit) per TargetClass value (dismount/light_veh/armour)
⋮----
def new_contact(self, req: PlaceUnitRequest) -> UnitContact
⋮----
def to_profile(self) -> dict
⋮----
"""Lightweight dict for ``GET /api/unit-profiles`` — UI drag-preview + popups
        read range/arc/label; ``eff`` lets the UI flag what each unit threatens."""
⋮----
# Canonical doctrinal defaults — sourced (see docs/ANALYSIS_LAYER.md "Unit & weapon realism";
# NATO + OPFOR open-source specs, fires doctrine, ballistics). obs_arc = observation sector
# (wide), weapon_arc = lethal sector of fire (narrow, on heading). eff = P(kill|hit) per class.
def _eff(dismount: float, light_veh: float, armour: float) -> dict[str, float]
⋮----
UNIT_CATALOG: dict[str, Unit] = {
⋮----
ph_p0=0.98, ph_shoulder=1.36, ph_beta=9.0, supp_s0=0.20, eff=_eff(0.80, 0.95, 0.95),  # 120 mm APFSDS, FCS
⋮----
ph_p0=0.90, ph_shoulder=1.00, ph_beta=4.0, supp_s0=0.50, eff=_eff(0.90, 0.85, 0.35),  # autocannon (+ATGM)
⋮----
ph_p0=0.70, ph_shoulder=0.63, ph_beta=2.4, supp_s0=0.65, eff=_eff(0.95, 0.65, 0.10),  # .50 HMG; rear blind spot
⋮----
ph_p0=0.95, ph_shoulder=0.90, ph_beta=2.2, supp_s0=0.35, eff=_eff(0.85, 0.10, 0.00),  # 5.56 rifle; assigned sector, rear blind
⋮----
ph_p0=0.97, ph_shoulder=1.19, ph_beta=8.0, supp_s0=0.0, eff=_eff(0.90, 0.10, 0.00),  # 7.62 bolt/DMR; scans a sector
⋮----
# indirect: no sector of fire; covers a range ANNULUS (min_range dead zone → max), gated by
# observation / pre-registered TRPs in fields.py. Hill params unused (area path, CEP-driven).
⋮----
ph_p0=0.0, ph_shoulder=1.0, ph_beta=2.0, supp_s0=0.0, eff=_eff(0.75, 0.45, 0.05),  # 120 mm
⋮----
ph_p0=0.85, ph_shoulder=0.87, ph_beta=2.0, supp_s0=0.10, eff=_eff(0.55, 0.85, 0.70),  # RPG-7 / AT4
⋮----
ph_p0=0.90, ph_shoulder=1.20, ph_beta=12.0, supp_s0=0.0, eff=_eff(0.40, 0.90, 0.95),  # top-attack guided
⋮----
# Legacy alias used by the analyzed-threat template (docs/THREAT_LIBRARY.md).
# ``sniper_op`` was the historical key for an OP-positioned sniper; canonical
# type is ``sniper``. Resolving through this alias keeps the threat-template
# pipeline consistent with the unit catalog.
_ALIAS: dict[str, str] = {"sniper_op": "sniper"}
⋮----
def resolve_unit(key: str) -> Unit | None
⋮----
"""Resolve a catalog key or legacy alias (e.g. ``sniper_op``) to a :class:`Unit`."""
⋮----
def unit_profiles() -> list[dict]
⋮----
"""Catalog as a list of profile dicts — serialised by ``GET /api/unit-profiles``."""
````

## File: src/backend/visibility.py
````python
"""Visibility layer — line-of-sight viewshed on the DSM.

The core Track-1 primitive. From an observer position, compute every cell it can
see, accounting for real surface height + the box occluders (so a shooter on a
roof sees over a wall, and dead ground behind a building is correctly hidden).

Radial sweep: cast rays out to max range, track the running max terrain elevation
angle; a cell is visible if the angle to a standing target there clears everything
closer. This is surface-accurate 2.5D visibility — honestly not volumetric.

    uv run python src/backend/visibility.py [--box 36_house] [--range 1200] [--arc 360]

Outputs: build/viewshed.tif (georeferenced) + build/viewshed.{bin,json}
(per web-cloud-point seen/not flag + observer; served by the FastAPI app at
/api/viewshed{,-info} for the viewer overlay).
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.terrain import BUILD, DATA, build_dsm, save_geotiff, world_to_pixel  # noqa: E402
⋮----
orow = int(np.clip(orow, 0, h - 1))
ocol = int(np.clip(ocol, 0, w - 1))
⋮----
obs_z = float(dsm[orow, ocol])
eye = obs_z + eye_h
⋮----
rng_cells = int(max_range / res)
n_az = max(720, int(2 * np.pi * rng_cells))            # ~1-cell spacing at edge
half = np.deg2rad(arc_deg / 2)
centre = np.deg2rad(facing_deg)
⋮----
azimuths = np.linspace(0, 2 * np.pi, n_az, endpoint=False)
⋮----
azimuths = np.linspace(centre - half, centre + half, max(2, int(n_az * arc_deg / 360)))
t = (np.arange(1, rng_cells + 1) * res).astype(np.float32)
⋮----
# All rays at once, shape (n_az, rng_cells). Sample the DSM along every ray,
# track the per-ray running-max terrain angle; a cell is seen if a standing
# target there clears everything nearer. Off-grid cells become -inf so they
# neither occlude nor register as visible. Same algorithm as the old per-
# azimuth Python loop — just lifted into numpy. (See viewshed --selfcheck.)
xs = ox + np.cos(azimuths)[:, None] * t[None, :]
ys = oy + np.sin(azimuths)[:, None] * t[None, :]
cols = ((xs - transform.c) / transform.a).astype(np.int64)
rows = ((transform.f - ys) / (-transform.e)).astype(np.int64)
ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
gh = np.where(ok, dsm[np.clip(rows, 0, h - 1), np.clip(cols, 0, w - 1)], -np.inf).astype(np.float32)
terr_ang = (gh - eye) / t[None, :]                     # blocking angle (terrain top)
tgt_ang = (gh + target_h - eye) / t[None, :]           # angle to a standing target
run = np.maximum.accumulate(terr_ang, axis=1)
prev = np.empty_like(run)
⋮----
seen = ok & (tgt_ang >= prev)
⋮----
vis = np.zeros((h, w), dtype=bool)
⋮----
"""Reference per-azimuth implementation, kept only for --selfcheck parity."""
⋮----
orow = int(np.clip(orow, 0, h - 1)); ocol = int(np.clip(ocol, 0, w - 1))
⋮----
vis = np.zeros((h, w), dtype=bool); vis[orow, ocol] = True
⋮----
n_az = max(720, int(2 * np.pi * rng_cells))
half = np.deg2rad(arc_deg / 2); centre = np.deg2rad(facing_deg)
⋮----
xs = ox + np.cos(a) * t; ys = oy + np.sin(a) * t
⋮----
m = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
⋮----
gh = dsm[rr, cc].astype(np.float32)
run = np.maximum.accumulate((gh - eye) / tt)
prev = np.empty_like(run); prev[0] = -np.inf; prev[1:] = run[:-1]
seen = (gh + target_h - eye) / tt >= prev
⋮----
def _selfcheck() -> None
⋮----
"""Prove the vectorized viewshed matches the reference loop bit-for-bit."""
⋮----
rng = np.random.default_rng(0)
h = w = 120
dsm = (rng.random((h, w)).astype(np.float32) * 20)
transform = Affine(2.0, 0, 1000.0, 0, -2.0, 5000.0)        # 2 m cells
obs_xy = (1000 + w * 2 * 0.4, 5000 - h * 2 * 0.6)
⋮----
ref = _viewshed_loop(dsm, transform, 2.0, obs_xy, 10.0, 1.7, 1.7, 150.0,
⋮----
boxes = json.loads(boxes_path.read_text())
⋮----
by_id = {b["id"]: b for b in boxes}
b = by_id.get(box_id) if box_id else max(
⋮----
boxes, key=lambda b: b["center"][2] + b["extent"][2] / 2)  # tallest = default OP
⋮----
top = cz + lz / 2
# Put the OP at the roof EDGE facing outward (away from the built-up centroid),
# not the centre — a real observer overlooks the approach, and the centre of a
# large flat roof occludes its own surrounding ground.
mx = sum(bb["center"][0] for bb in boxes) / len(boxes)
my = sum(bb["center"][1] for bb in boxes) / len(boxes)
⋮----
d = math.hypot(dx, dy) or 1.0
reach = 0.48 * max(lx, ly)
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Compute a viewshed from an observer")
⋮----
args = ap.parse_args()
⋮----
t = build_dsm(DATA / "point_cloud.ply", args.res, DATA / "bounding_boxes.json")
xy = (args.x, args.y) if args.x is not None and args.y is not None else None
⋮----
obs_z = (obs_top + args.eye) if obs_top is not None else None
⋮----
eye = (obs_top if obs_top is not None else float(t["dsm"][orow, ocol])) + args.eye
⋮----
# sample per web-cloud-point for the viewer overlay. Pack the exact same points
# the FastAPI viewer serves (same fn + defaults => identical indices, aligned overlay).
pack = pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
meta = pack["meta"]
⋮----
n = meta["n"]
buf = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
wx = buf[:, 0] + ox
wy = buf[:, 1] + oy
tr = t["transform"]
cols = ((wx - tr.c) / tr.a).astype(np.int64)
rows = ((tr.f - wy) / (-tr.e)).astype(np.int64)
⋮----
flags = np.zeros(n, dtype=np.uint8)
⋮----
obs_eye_world = (obs_xy[0], obs_xy[1], eye)
info = {
⋮----
# recentred into the viewer's local frame (east->X, up->Y, north->-Z)
````

## File: src/frontend/src/components/ObjectPopup.tsx
````typescript
import { useStore } from '../lib/store'
import InfoPanelPopup, { DataRow } from './InfoPanelPopup'
````

## File: src/frontend/src/index.css
````css
@tailwind base;
@tailwind components;
@tailwind utilities;
⋮----
@layer base {
⋮----
html,
⋮----
body {
⋮----
button:focus-visible,
⋮----
::selection {
⋮----
@layer components {
⋮----
/* Flat industrial chrome: hairline borders, no gradients/glow/blur. */
.skip-link {
⋮----
.app-shell {
⋮----
.panel {
⋮----
.eyebrow {
⋮----
.tactical-button {
⋮----
.tactical-button:hover:not(:disabled) {
⋮----
.legend-cell {
⋮----
.legend-cell:hover {
⋮----
.segmented-toggle {
⋮----
.segmented-toggle > button + button {
⋮----
.skeleton-bar {
⋮----
.skeleton-bar::after {
⋮----
*,
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
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "rasterio>=1.4",
    "shapely>=2.0",
    "scipy>=1.13",
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
section-order = ["future", "standard-library", "third-party", "first-party", "local-folder"]

# Enables Ruff formatter with default options (Black-compatible)
[tool.ruff.format]
````

## File: run.sh
````bash
#!/bin/bash

export PATH="$(pwd)/.venv/bin:$PATH"

# Ports come from the shared config (src/config.json) so front and back agree.
read -r HOST PORT FE_PORT < <(python3 -c "import json;c=json.load(open('src/config.json'));print(c['backend']['host'],c['backend']['port'],c['frontend']['port'])")

echo "Starting backend on http://$HOST:$PORT"
source .venv/bin/activate
uv run uvicorn src.backend.app:app --host "$HOST" --port "$PORT" --reload --reload-dir src &
BACKEND_PID=$!

echo "Starting frontend on http://127.0.0.1:$FE_PORT"
npm --prefix src/frontend run dev &
FRONTEND_PID=$!

cleanup() {
  echo "Shutting down..."
  for PID in $BACKEND_PID $FRONTEND_PID; do
    kill -TERM -- "-$PID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "Done."
}

trap cleanup INT TERM

wait
````

## File: src/frontend/index.html
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SE3 Recon turns georeferenced point clouds into tactical line-of-sight and object inspection decisions." />
    <meta property="og:title" content="SE3 Recon Tactical Viewer" />
    <meta property="og:description" content="A tactical 3D viewer for point-cloud terrain, object boxes, and viewshed readiness." />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#071014" />
    <title>SE3 Tactical Intelligence</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

## File: README.md
````markdown
# SE3 Reconnaissance — Tactical AI Layer

> EDTH Munich · SE3 Labs challenge. A tactical-reasoning layer on top of SE3's
> georeferenced 3D battlefield reconstruction. The operator marks the enemy from
> intel; the system projects what they threaten — *fields of fire, kill zones,
> where am I exposed* — fast and legible. It is **operator-driven**: place the
> enemy, the threat is computed (no auto-templating).

Docs:
- [`docs/challange.md`](docs/challange.md) — the challenge brief & our direction
- [`docs/data.md`](docs/data.md) — exactly what's in the dataset (inspected, not assumed)
- [`docs/ANALYSIS_LAYER.md`](docs/ANALYSIS_LAYER.md) — the analysis engine: unit/weapon realism, per-target-class risk
- [`docs/THREAT_LIBRARY.md`](docs/THREAT_LIBRARY.md) — the unit/weapon model: per-type observation + weapon envelopes (`units.py`)
- [`docs/MANEUVER_ANALYSIS.md`](docs/MANEUVER_ANALYSIS.md) — Blue course of action: threat maps, covered approach, suppression priority, go/no-go

## Repo layout

```
.
├── data/                 # provided inputs — gitignored (get from the SE3 mentor)
│   ├── point_cloud.ply   #   ~4M-point cloud, XYZ (UTM, metres) + RGB
│   └── bounding_boxes.json#   58 oriented object boxes + thermal signature
├── src/
│   ├── config.json       # shared backend/frontend ports + cloud voxel/max_points
│   ├── backend/          # Python: data IO + FastAPI server + tactical analysis
│   │   ├── io.py         #   PLY reader (memmap, zero-copy)
│   │   ├── app.py        #   FastAPI: packs cloud on startup, serves /api/*, /threat/recompute
│   │   ├── terrain.py    #   DSM from cloud + boxes as occluders (build/dsm.tif)
│   │   ├── visibility.py #   line-of-sight viewshed (the core primitive)
│   │   ├── units.py      #   UNIT_CATALOG — single source of truth for the 8 unit types
│   │   ├── threat_template.py # build threat.json from operator-placed enemies
│   │   ├── fields.py     #   project laydown → kill zones / danger / P(fatal), per target class
│   │   └── scripts/      #   inspect_ply.py (data sanity-check)
│   └── frontend/         # React + Vite + TypeScript + Tailwind + zustand; raw three.js
│       ├── src/
│       │   ├── engine/   #   Viewer.ts — the three.js world (cloud, boxes, markers, overlays, GLB unit models)
│       │   ├── components/ # SceneCanvas, Hud, Sidebar, FriendlyPanel, DangerAlert, *Popup
│       │   └── lib/      #   api.ts, store.ts (zustand), types.ts, colors.ts, utils.ts
│       ├── public/assets/#   per-type .glb unit models (tank, ifv, sniper, …) — gitignored
│       ├── package.json  #   React, Vite, three.js, TailwindCSS, zustand
│       └── index.html    #   vite entry
├── build/                # generated layers (DSM/viewshed/threat/danger/fields) — gitignored
├── docs/                 # challenge brief + data findings + analysis-layer notes
├── pyproject.toml        # uv / hatchling project (ruff configured)
└── run.sh                # ./run.sh → uvicorn (:8011) + vite (:5173)
```

## Quickstart

```bash
# 1. install python deps (uv)
uv sync

# 2. put the provided files in data/  (not in git)
#    data/point_cloud.ply
#    data/bounding_boxes.json

# 3. install frontend deps (npm)
cd src/frontend && npm install && cd ../..

# 4. start both backend + frontend with one command
./run.sh

# Then open http://localhost:5173 in your browser
# (Ctrl-C stops both servers)

# 5. (optional) build the interactive-LOS viewshed overlay
uv run python src/backend/visibility.py   # writes build/viewshed.*
```

The app lives at <http://localhost:5173> (Vite); it proxies `/api` to the FastAPI
backend on `:8011` (the backend serves data, not the UI). Inspect the raw cloud
any time with:

```bash
uv run python src/backend/scripts/inspect_ply.py
```

## The viewer

True 1:1 scale (no vertical exaggeration). Opens **blank** — terrain point cloud
(RGB / height-coloured) plus all 58 oriented object boxes (per-class show/hide,
click any box for its dimensions / temperature / UTM position). North arrow +
100 m grid for scale.

**Operator-driven placement.** Pick a unit type, click the map to drop each enemy
(rendered as a 3D `.glb` model with its sector of fire); optionally place friendly
positions. The threat **auto-projects** whenever the laydown changes — no manual
"analyse" button, no page reload (debounced, single-flight in `SceneCanvas`).

Analysis surfaces (enabled once a laydown exists), each selectable **per target
class** — Infantry / Light veh / Armour:
- **Risk Classification** — the continuous danger cost (kill zone → dead ground →
  cover → out of range), with a colour legend.
- **Crossfire Indicator** — engagement-area depth (≥ 2 = mutually-supporting kill
  zone).
- **Probability of Lethal Fire** — the true P(fatal) surface (`pfatal`).

A **danger-alert** banner warns the instant a placed friendly is exposed by the
current laydown, grouped by tier (kill zone / high / moderate) with a locate
button. An interactive **LOS** viewshed (drop a point → what's visible) is
available after `visibility.py` has run.

## Status / roadmap

The operator marks the enemy from intel; the system projects what they threaten.
The spine is one primitive — the **viewshed** — because observation gates
lethality (direct fire: a weapon sees you; indirect fire: an observer sees you).
See the docs above.

- [x] Data ingest + inspection, web 3D viewer with semantic objects + thermal
- [x] Terrain DSM from the cloud + the 58 boxes as occluders (`terrain.py`)
- [x] **Viewshed / line-of-sight engine** (`visibility.py`) + interactive LOS — core
- [x] **Operator-driven manual placement** of enemy/friendly units (`/api/units`)
- [x] Unit/weapon realism — 8 types, two-arc model, per-class lethality (`units.py`)
- [x] Threat projection: kill zones, danger, P(fatal), sectors of fire, TRPs (`fields.py`)
- [x] Per-target-class risk surfaces (dismount / light vehicle / armour)
- [x] Auto-project on laydown change + soldier danger-alert banner
- [x] 3D unit models in the scene (per-type `.glb`)
- [ ] Vegetation / concealment layer from the cloud (cover vs concealment, `landcover.py`)
- [ ] Covered-approach / exposure routing — "how do I get there alive" (`routes.py`)
- [ ] Scan speed — cache the DSM across recomputes

## Team

Data lives outside git — share the two files directly. Work on feature branches
off `main`; the viewer needs only `./run.sh` after you drop the data in.
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
*__pycache__*
src/frontend/.vite/

# ---- frontend (node + build output) ----
src/frontend/node_modules/
src/frontend/dist/
# generated web assets — only .gitkeep is tracked (data comes from the API/build)
src/frontend/public/*
!src/frontend/public/.gitkeep
# unit 3D models are real source assets (loaded by Viewer.ts), keep them tracked
!src/frontend/public/assets/
src/frontend/.env.local
src/frontend/.env*.local

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
# backend generated (DSM, viewshed, threat, etc.)
build/
# Python package dist
dist/
uv.lock

# ---- tooling / editor / os ----
.claude/
.playwright-mcp/
.DS_Store
__MACOSX/
.vscode/
.idea/

# stale tsc emits
src/frontend/vite.config.js
src/frontend/vite.config.d.ts

# local-only dev runner (uses existing .venv/node_modules, no reinstall)
run.local.sh
````

## File: src/frontend/src/components/FriendlyPanel.tsx
````typescript
import { postReset, clearUnits } from '../lib/api'
import { useStore } from '../lib/store'
import { UnitType } from '../lib/types'
⋮----
// Doctrinal unit choices come from /api/unit-profiles (backend UNIT_CATALOG).
// The same catalog drives both sides — adding a new unit type later needs no
// frontend change.
⋮----
// Static class strings — Tailwind's JIT cannot see interpolated names.
⋮----
// Threat projection is automatic now (SceneCanvas re-projects on every laydown
// change); no manual "analyse" step. Reset stays a full reload — it's the
// intentional wipe back to a blank battlefield, not the per-analysis rerender.
// Wipe all placed units + analysed laydown, then reload so scene is fully blank.
const reset = async () =>
⋮----
// place / move / remove are mutually exclusive map modes
const togglePlacing = () =>
const toggleMoving = () =>
const toggleRemoving = () =>
const selectSide = (side: 'hostile' | 'friendly') =>
⋮----
{/* side selector: enemy (red) | ally (blue) */}
⋮----
<button onClick=
⋮----
{/* place / move / remove map modes — grouped right under the side selector */}
⋮----
onClick=
````

## File: src/backend/fields.py
````python
"""Threat projection — what the enemy laydown actually covers (fires + observation).

Takes the likely enemy positions (threat_template output) and projects each one's
real threat onto the terrain, then combines them the way a real IPB fires-and-
observation overlay is built. Design choices (per operator review):

1. CONTINUOUS cost, not a red/green mask — the route planner needs a gradient;
   we threshold only for the human display.
2. ENGAGEMENT-AREA DEPTH — observation is a COUNT of how many enemy can see/engage
   a cell, not a union. Depth >= 2 = mutually-supporting kill zone (cross-fire).
5. Two TARGET HEIGHTS — dead ground depends on the target: dismount (1.7 m) finds
   cover a vehicle (2.5 m) does not. We output both.
6. RANGE-GRADUATED lethality (p_hit decays past effective range, not a hard edge)
   and per-asset SECTOR OF FIRE (a hull-down tank covers an arc, not 360deg).
4. Indirect = mortar_range AND (observed OR pre-planned TRPs on chokepoints) — so an
   attacker can't "game" the map by hugging dead ground through a registered defile.

Honest limit: the DSM treats tree canopy as a solid occluder, so dead ground behind
vegetation is really CONCEALMENT (hides you, doesn't stop a round). Until
landcover.py exists we tag that as lower-confidence, not fully safe.

    uv run python src/backend/fields.py [--side west]

Outputs: build/fields_{cost,depth}.tif + build/{danger,depth}.bin + fields.json
(served by /api/{danger,depth,fields-info}).
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.app import CONFIG, MAX_POINTS, PACK, VOXEL, pack_cloud, terrain_for  # noqa: E402
from src.backend.terrain import BUILD, DATA, box_polygon, save_geotiff  # noqa: E402
from src.backend.units import TARGET_HEIGHT_M, resolve_unit  # noqa: E402
from src.backend.visibility import viewshed  # noqa: E402
⋮----
# target classes (units.TARGET_HEIGHT_M): dismount 1.7 m · light_veh 2.5 m · armour 2.5 m.
# light_veh + armour share a LOS height, so the viewshed is still only ever traced at two heights.
CLASSES = list(TARGET_HEIGHT_M)
HEIGHTS = sorted(set(TARGET_HEIGHT_M.values()))
KILL_EPS = 0.05   # a cell counts toward a class's engagement depth once P(kill) clears this
# ponytail: one global exposure multiplier — shots a target absorbs while crossing an exposed cell;
# turns single-shot SSKP into cumulative P(kill) = 1-(1-p)^n. =1 → single shot (no change).
# Per-weapon rate-of-fire (catalog field) if absolute calibration ever matters; relative map holds either way.
EXPOSURE_SHOTS = float(CONFIG.get("fires", {}).get("exposure_shots", 1))
⋮----
def _profile(typ: str) -> dict
⋮----
"""Reshape a units.UNIT_CATALOG entry into the projection dict the loop reads."""
u = resolve_unit(typ)
⋮----
"s0": u.supp_s0, "kill": u.eff,   # P(kill|hit) per target class
⋮----
def p_hit(dist: np.ndarray, p0: float, d50: float, beta: float, mn: float, mx: float) -> np.ndarray
⋮----
"""Per-weapon single-shot P(hit) vs a point target: Hill plateau p0, knee at d50, steepness
    beta (high = accurate-far-then-cliff, low = far-but-inaccurate). Zero outside [mn, mx]."""
p = p0 / (1.0 + (dist / d50) ** beta)
inside = (dist >= mn) & (dist <= mx)
⋮----
def p_supp(dist: np.ndarray, s0: float, mx: float) -> np.ndarray | None
⋮----
"""Area suppression: a wide, low beaten-zone field (MGs / autofire). None for precision weapons."""
⋮----
s = s0 / (1.0 + (dist / (1.05 * mx)) ** 3)
⋮----
def _arc_mask(gx: np.ndarray, gy: np.ndarray, e: float, n: float, facing_deg: float, arc_deg: float) -> np.ndarray
⋮----
"""Cells within ±arc/2 of facing (viewshed math-angle frame). arc>=360 → all True."""
⋮----
az = np.degrees(np.arctan2(gy - n, gx - e))
⋮----
# Per-shooter viewshed cache. A shooter's line-of-sight depends only on its own
# (position, facing, type) and the fixed DSM at this resolution — so we key on
# exactly that and reuse the grid across recomputes. Editing one unit then
# re-sweeps one unit, not the whole laydown. Content-keyed: a moved/reoriented
# unit yields a new key and misses; old entries are inert, never stale.
_VIS_CACHE: dict[tuple, np.ndarray] = {}
_VIS_CAP = 512  # ~0.25 MB/grid; flushed wholesale past the cap (no LRU until churn proves it needed)
⋮----
"""Observation viewshed for one shooter at one target height — traced at the wide obs arc and
    memoised on its content key (position, heading, type, height) so editing one unit re-sweeps one."""
⋮----
key = (round(E, 1), round(N, 1), round(U, 1), e["facing_deg"], e["type"], round(target_h, 1), res)
vis = _VIS_CACHE.get(key)
⋮----
def run(side: str = "west", res: float = 2.0) -> dict
⋮----
"""Project the enemy laydown into threat fields — callable from CLI and /recompute."""
t = terrain_for(res)  # reuse the API's DSM cache (build_dsm under the hood); free when already warm
⋮----
threat = json.loads((BUILD / "threat.json").read_text())
enemies = threat["positions"]
⋮----
# coordinate grids (cell centres, UTM) for range / distance maths
⋮----
gx = transform.c + (cols + 0.5) * transform.a
gy = transform.f - (rows + 0.5) * (-transform.e)
⋮----
# per TARGET-CLASS accumulators. P(kill) = P(hit) × P(kill|hit): vis×p_hit is P(hit); the
# eff[class] factor is P(kill|hit). A weapon with eff[class]==0 (a rifle vs armour) drops out.
depth = {c: np.zeros((h, w), np.int16) for c in CLASSES}      # engagement-area depth per class
direct = {c: np.zeros((h, w), np.float32) for c in CLASSES}   # P(kill) union per class
suppress = {c: np.zeros((h, w), np.float32) for c in CLASSES}  # suppression (beaten zone) per class
reach = {c: np.zeros((h, w), bool) for c in CLASSES}          # a class-killing weapon can RANGE the cell
conf = {c: np.zeros((h, w), np.float32) for c in CLASSES}     # intel-confidence the cell is threatened
observed = np.zeros((h, w), bool)     # union of all eyes (observation arc) — the indirect-fire cue
n_direct = 0
⋮----
prof = _profile(e["type"])
⋮----
facing = float(e["facing_deg"])   # operator-set heading (= weapon PDF), viewshed math angle
ec = float(e.get("confidence", 1.0))
dist = np.hypot(gx - E, gy - N)
band = (dist >= prof["mn"]) & (dist <= prof["mx"])               # weapon range annulus
wmask = _arc_mask(gx, gy, E, N, facing, prof["weapon_arc"])      # LETHAL sector of fire
pr = p_hit(dist, prof["p0"], prof["d50"], prof["beta"], prof["mn"], prof["mx"])
sup = p_supp(dist, prof["s0"], prof["mx"])
# one viewshed per LOS height, traced at the wide OBSERVATION arc (memoised per shooter —
# editing one unit re-sweeps one unit); the lethal layer masks it to the weapon sector
# (LOS is arc-independent → no extra ray casts vs the old single-arc model).
vis_by_h = {th: _shooter_vis(dsm, transform, res, e, prof, th) for th in HEIGHTS}
observed |= vis_by_h[TARGET_HEIGHT_M["dismount"]]               # detection (eyes), full obs arc
⋮----
kc = float(prof["kill"].get(c, 0.0))
⋮----
continue                                                # this weapon can't kill class c
vis_w = vis_by_h[TARGET_HEIGHT_M[c]] & wmask & band         # weapon-sector lethal LOS
kill = vis_w * pr * kc                                      # single-shot P(kill | shooter present)
kcum = 1.0 - (1.0 - kill * ec) ** EXPOSURE_SHOTS           # exposure window × P(enemy actually here)
direct[c] = 1.0 - (1.0 - direct[c]) * (1.0 - kcum)         # probabilistic union over shooters
depth[c] += (kill > KILL_EPS)                              # structural count of weapons (pre-confidence)
⋮----
# ---- pre-planned TRPs on terrain-forced chokepoints (point 4) ----
box_mask = np.zeros((h, w), bool)
⋮----
box_mask = rasterize([(box_polygon(b), 1) for b in json.loads((DATA / "bounding_boxes.json").read_text())],
passable = (~box_mask) & t["valid"]
clearance = distance_transform_edt(passable) * res       # corridor half-width (m)
ridge = (clearance == maximum_filter(clearance, size=3)) & passable   # medial axis
choke = ridge & (clearance > 1.5) & (clearance < 7)           # narrow passages on the route net
trp = np.zeros((h, w), bool)
⋮----
for i in np.argsort(clearance[cr, cc]):                       # narrowest first
⋮----
trp[max(0, r - 2):r + 3, max(0, c - 2):c + 3] = True      # TRP beaten zone
⋮----
# ---- indirect: range ANNULUS (min-range dead zone → max) AND (observed by any eyes OR a
#      pre-registered TRP). `observed` is the union of every unit's observation arc (above). ----
in_range = np.zeros((h, w), bool)
ind_kill = {c: np.zeros((h, w), np.float32) for c in CLASSES}   # per-cell P(kill|hit) × presence confidence
⋮----
d = np.hypot(gx - E, gy - N)
ann = (d >= prof["mn"]) & (d <= prof["mx"])
⋮----
ind_kill[c] = np.maximum(ind_kill[c], ann * kc * ec)   # gated to this tube's annulus
indirect = in_range.astype(np.float32) * np.clip(0.6 * observed + 0.7 * trp, 0.0, 0.9)
⋮----
# ---- cover (boxes stop rounds) reduces risk; combine into one continuous cost PER CLASS ----
cover_near = np.clip(1.0 - distance_transform_edt(~box_mask) * res / 8.0, 0.0, 1.0)
valid = t["valid"]
⋮----
emphasis = 1.0 + 0.35 * np.clip(depth[c] - 1, 0, None)            # kill zones (overlap) hurt more
cost = (direct[c] + 0.5 * indirect * ind_kill[c]) * emphasis - 0.3 * cover_near
⋮----
# P(fatal enemy fire): independent-union of direct + indirect lethal hits. A valid marginal
# probability — every term carries P(kill|hit) AND P(enemy actually placed here) (the `ec`
# weighting above), unlike `cost`, which credits cover and emphasises kill zones for routing.
p_ind = np.clip(indirect * ind_kill[c], 0.0, 1.0)
pf = 1.0 - (1.0 - direct[c]) * (1.0 - p_ind)
⋮----
# WHY a cell is (un)safe — "not seen" != "safe": canopy is concealment, only a box stops a
# round. (0 out-of-range, 1 dead-ground, 2 cover, 3 exposed)
seen = depth[c] > 0
near_cover = cover_near > 0.5
⋮----
# ---- per-web-point overlays for the viewer ----
# reuse the cloud the API already holds in RAM; only re-pack when run standalone (CLI, no lifespan)
pack = PACK if PACK.get("meta") else pack_cloud(DATA / "point_cloud.ply", VOXEL, MAX_POINTS)
meta = pack["meta"]
⋮----
n = meta["n"]
pts = np.frombuffer(pack["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
pc = ((pts[:, 0] + ox - transform.c) / transform.a).astype(np.int64)
prow = ((transform.f - (pts[:, 1] + oy)) / (-transform.e)).astype(np.int64)
ok = (pc >= 0) & (pc < w) & (prow >= 0) & (prow < h)
⋮----
def _sample(arr: np.ndarray, scale: float = 1.0) -> bytes
⋮----
b = np.zeros(n, np.uint8)
⋮----
# one set per target class — the "show risk to" toggle picks which (default = dismount)
⋮----
nv = max(1, int(valid.sum()))
def _pct(mask: np.ndarray) -> float
⋮----
def _class_stats(c: str) -> dict
⋮----
rc = reasons[c]
⋮----
dismount = _class_stats("dismount")
⋮----
# ---- per-soldier exposure: classify each placed friendly (the laydown's avenue points) into a
#      risk zone on the dismount surface, so the UI can warn "this soldier is in danger" the
#      instant a newly-spotted enemy puts them at risk (bands match riskBand() in the frontend) ----
⋮----
def _zone(d: int, k: int) -> str
⋮----
if k >= 2 or d >= 204:    # mutually-supporting fire / near-certain hit
⋮----
if d >= 128:              # p_hit >= 0.5
⋮----
if d >= 51 or k >= 1:     # p_hit >= 0.2, or seen at all
⋮----
soldiers = []
⋮----
col = int((e_m - transform.c) / transform.a)               # floor — matches the per-point sampling
row = int((transform.f - n_m) / (-transform.e))
⋮----
# worst case in a small window around the soldier (a soldier isn't a point, and it makes the
# warning conservative + robust to single-cell gaps in a sparse exposed surface)
⋮----
dval = int(round(float(cost_d[r0:r1, c0:c1].max()) * 255))
kval = int(depth_d[r0:r1, c0:c1].max())
⋮----
info = {
⋮----
"soldiers": soldiers,   # placed friendlies + their current risk zone (drives the danger banner)
# top-level mirrors the dismount class (the default risk view / current frontend reads these)
⋮----
def main() -> None
⋮----
ap = argparse.ArgumentParser(description="Project the enemy laydown into threat fields")
⋮----
a = ap.parse_args()
````

## File: src/backend/threat_template.py
````python
"""Enemy laydown — built from OPERATOR-placed positions (real intel), not auto-templated.

The operator (with the soldiers) marks where the enemy actually is on the map; we turn
those marks into a structured laydown that fields.py then projects into fields of fire,
engagement-area depth (kill zones) and the danger surface. No guessing where the enemy
might be — the human provides ground truth, the system does the spatial reasoning.

Called from /api/threat/recompute with the placed enemies (and optionally our own
positions, which the shooters are oriented onto).
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
⋮----
from src.backend.io import read_ply  # noqa: E402
from src.backend.terrain import BUILD, DATA  # noqa: E402
from src.backend.units import resolve_unit  # noqa: E402
⋮----
def from_manual(enemies: list[dict], friendly: list[tuple[float, float, float]] | None = None) -> dict
⋮----
"""enemies: [{e,n,u,type}] (type ∈ sniper_op|tank|mortar|...). friendly: [[E,N,U]] (optional).

    Writes build/threat.json — the laydown fields.py projects. Direct-fire shooters are
    oriented onto our positions if given, else toward the scene centre. Per-type arc
    and role come from the unit catalog (single source of truth, units.py).
    """
v = read_ply(DATA / "point_cloud.ply")
⋮----
fx = float(np.mean([f[0] for f in friendly]))
fy = float(np.mean([f[1] for f in friendly]))
⋮----
positions = []
⋮----
unit = resolve_unit(typ)
role = unit.role.value if unit else "observer"
arc = unit.obs_arc if unit else 0
az = en.get("azimuth")
⋮----
facing = 0.0                                   # indirect fire has no sector of fire
⋮----
# operator's placed heading: compass bearing (grid-north, CW) → viewshed math angle (0=E, CCW)
facing = 90.0 - float(az)
⋮----
# no heading given (e.g. click-placed) → orient onto our positions, else scene centre
facing = float(math.degrees(math.atan2(fy - N, fx - E)))
⋮----
# intel quality of this contact (units.UnitContact.confidence) — drives risk-zone confidence
⋮----
info = {
⋮----
def main() -> None
````

## File: src/frontend/src/App.tsx
````typescript
import { useStore } from './lib/store'
import SceneCanvas from './components/SceneCanvas'
import Hud from './components/Hud'
import ObjectPopup from './components/ObjectPopup'
import ThreatPanel from './components/ThreatPanel'
import ThreatPopup from './components/ThreatPopup'
import PlacedUnitPopup from './components/PlacedUnitPopup'
import FriendlyPanel from './components/FriendlyPanel'
import AnalyzingSpinner from './components/AnalyzingSpinner'
import DangerAlert from './components/DangerAlert'
````

## File: src/frontend/src/lib/api.ts
````typescript
import { CloudMeta, BoundingBox, ViewshedInfo, ThreatInfo, FieldsInfo, WorldCoordinate, ViewshedResult, UnitContact, PlaceUnitRequest, UnitProfile } from './types'
⋮----
// Relative URLs: dev goes through the Vite proxy (vite.config.ts), prod is
// served same-origin. Required GETs throw; optional ones resolve to null.
const json = <T>(p: string): Promise<T>
⋮----
const optional = async <T>(p: string): Promise<T | null> =>
⋮----
export const fetchMeta = ()
export const fetchBoxes = ()
export const fetchViewshedInfo = ()
⋮----
export const fetchCloud = async (): Promise<ArrayBuffer> =>
⋮----
export const fetchViewshed = async (): Promise<Uint8Array | null> =>
⋮----
export const fetchThreatInfo = ()
⋮----
export const fetchThreat = async (): Promise<Uint8Array | null> =>
⋮----
export const fetchFieldsInfo = ()
⋮----
const bin = async (p: string): Promise<Uint8Array | null> =>
// risk surfaces are per target class (dismount/light_veh/armour); omit for the default (dismount)
const cq = (p: string, cls?: string) => bin(cls ? `$
export const fetchDanger = (cls?: string)
export const fetchPfatal = (cls?: string) => cq('/api/pfatal', cls)  // P(fatal enemy fire), true probability
export const fetchDepth = (cls?: string)
export const fetchReason = (cls?: string) => cq('/api/reason', cls)  // 0 out-of-range 1 dead-ground 2 cover 3 exposed
export const fetchConf = (cls?: string) => cq('/api/conf', cls)       // intel-confidence the cell is threatened
⋮----
export const fetchViewshedAt = async (world: WorldCoordinate): Promise<ViewshedResult> =>
⋮----
// Build the enemy laydown from operator-placed positions + project the fields. Heavy (~15 s).
// Omit body to use the backend's /api/units store as the source.
export const postRecompute = (): Promise<
⋮----
// Wipe the analysed laydown (enemy markers + projected fields) — back to a blank battlefield.
export const postReset = (): Promise<
⋮----
export const fetchUnits = (): Promise<UnitContact[]>
⋮----
export const fetchUnitProfiles = (): Promise<UnitProfile[]>
⋮----
export const postUnit = (req: PlaceUnitRequest): Promise<UnitContact>
⋮----
export const patchUnit = (id: string, patch:
⋮----
export const deleteUnit = (id: string): Promise<void>
⋮----
export const clearUnits = (side?: 'hostile' | 'friendly'): Promise<void>
````

## File: src/backend/app.py
````python
"""FastAPI backend: pack the point cloud once on startup, serve it as an API.

    uv run uvicorn src.backend.app:app --port 8011      (or ./run.sh)

The UI is served separately by Vite (src/frontend). Endpoints:
  /api/meta · /api/cloud (binary) · /api/boxes
  /api/viewshed (binary) · /api/viewshed-info  — present only after
  `uv run python src/backend/visibility.py` writes them to build/.
"""
⋮----
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
BUILD = ROOT / "build"          # viewshed.{bin,json} land here (gitignored)
⋮----
CONFIG = json.loads((ROOT / "src" / "config.json").read_text())  # shared with frontend
VOXEL = CONFIG["cloud"]["voxel_m"]          # metres per voxel
MAX_POINTS = CONFIG["cloud"]["max_points"]  # cap on served points
⋮----
PACK: dict = {}  # {"bin": bytes, "meta": {...}} filled on startup
TERRAIN: dict[float, dict] = {}
UNITS: dict[str, UnitContact] = {}  # in-memory contact store; resets on server restart
⋮----
class ViewshedRequest(BaseModel)
⋮----
x: float
y: float
z: float | None = None
range_m: float = Field(1200.0, gt=0)
arc_deg: float = Field(360.0, gt=0, le=360)
facing_deg: float = 0.0
eye_h: float = 1.7
target_h: float = 1.7
res_m: float = Field(1.0, gt=0)
⋮----
def pack_cloud(ply: Path, voxel: float, max_points: int) -> dict
⋮----
"""Voxel-downsample to one point per occupied cell, recenter to a local origin.

    UTM doubles exceed float32 precision, so positions are stored relative to the
    min corner; the viewer works in metres from that origin. Layout of "bin":
    N float32 positions (xyz) followed by N uint8 colours (rgb).
    """
v = read_ply(ply)
⋮----
vi = ((x - ox) / voxel).astype(np.uint64)
vj = ((y - oy) / voxel).astype(np.uint64)
vk = ((z - oz) / voxel).astype(np.uint64)
_, sel = np.unique((vi << 42) | (vj << 21) | vk, return_index=True)  # one per voxel
⋮----
sel = np.sort(np.random.default_rng(0).choice(sel, max_points, replace=False))
⋮----
pos = np.empty((sel.size, 3), np.float32)
⋮----
# Source X/Y sit on a perfect 1/16 m DSM lattice, which renders as moiré
# "corduroy" lines. Sub-voxel horizontal jitter breaks the grid; no point
# moves more than half a voxel, and z (true elevation) is left untouched.
⋮----
col = np.empty((sel.size, 3), np.uint8)
⋮----
def terrain_for(res_m: float) -> dict
⋮----
def flags_for_viewshed(vis: np.ndarray, transform: Affine) -> np.ndarray
⋮----
meta = PACK["meta"]
n = meta["n"]
⋮----
buf = np.frombuffer(PACK["bin"], dtype=np.float32, count=n * 3).reshape(n, 3)
wx = buf[:, 0] + ox
wy = buf[:, 1] + oy
cols = ((wx - transform.c) / transform.a).astype(np.int64)
rows = ((transform.f - wy) / (-transform.e)).astype(np.int64)
⋮----
ok = (cols >= 0) & (cols < w) & (rows >= 0) & (rows < h)
flags = np.zeros(n, dtype=np.uint8)
⋮----
def clear_laydown() -> None
⋮----
"""Wipe the operator's enemy laydown and everything projected from it.

    The laydown is per-session intel, never carried over: the battlefield must
    open blank (terrain + object boxes only) until the operator places the enemy
    and analyses. Terrain artifacts (DSM, viewshed) are independent and kept.
    """
⋮----
@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]
⋮----
clear_laydown()  # start every session with an empty battlefield
⋮----
app = FastAPI(lifespan=lifespan)
⋮----
# Dev convenience: allow the Vite dev server to hit the API directly too.
_fe = CONFIG["frontend"]["port"]
⋮----
@app.get("/api/meta")
def meta() -> dict
⋮----
@app.get("/api/cloud")
def cloud() -> Response
⋮----
@app.get("/api/boxes")
def boxes() -> FileResponse
⋮----
@app.get("/api/viewshed")
def viewshed_bin() -> Response
⋮----
f = BUILD / "viewshed.bin"
⋮----
@app.post("/api/viewshed")
def viewshed_at_cursor(req: ViewshedRequest) -> Response
⋮----
terrain = terrain_for(req.res_m)
⋮----
flags = flags_for_viewshed(vis, terrain["transform"])
info = {
⋮----
@app.get("/api/viewshed-info")
def viewshed_info() -> Response
⋮----
f = BUILD / "viewshed.json"
⋮----
@app.get("/api/threat")
def threat_bin() -> Response
⋮----
f = BUILD / "threat.bin"
⋮----
@app.get("/api/threat-info")
def threat_info() -> Response
⋮----
f = BUILD / "threat.json"
⋮----
def _bin(name: str) -> Response
⋮----
f = BUILD / name
⋮----
# risk surfaces are projected per TARGET CLASS; ?class= picks who's moving (default dismount)
_RISK_CLASSES = {"dismount", "light_veh", "armour"}
⋮----
def _class_bin(kind: str, cls: str) -> Response
⋮----
c = cls if cls in _RISK_CLASSES else "dismount"
⋮----
@app.get("/api/danger")
def danger(cls: str = Query("dismount", alias="class")) -> Response
⋮----
@app.get("/api/pfatal")
def pfatal(cls: str = Query("dismount", alias="class")) -> Response:  # P(fatal enemy fire), 0-255
⋮----
@app.get("/api/depth")
def depth(cls: str = Query("dismount", alias="class")) -> Response
⋮----
@app.get("/api/reason")
def reason(cls: str = Query("dismount", alias="class")) -> Response:  # 0 out-of-range 1 dead-ground 2 cover 3 exposed
⋮----
@app.get("/api/conf")
def conf(cls: str = Query("dismount", alias="class")) -> Response:    # intel-confidence the cell is threatened
⋮----
@app.get("/api/suppress")
def suppress(cls: str = Query("dismount", alias="class")) -> Response:  # suppression (beaten zone) field
⋮----
@app.get("/api/fields-info")
def fields_info() -> Response
⋮----
f = BUILD / "fields.json"
⋮----
# ---- unit contact store -------------------------------------------------------
⋮----
@app.get("/api/units")
def list_units(side: str | None = None) -> list[UnitContact]
⋮----
units = list(UNITS.values())
⋮----
units = [u for u in units if u.side.value == side]
⋮----
@app.get("/api/unit-profiles")
def unit_profiles_endpoint() -> list[dict]
⋮----
"""Doctrinal catalog as lightweight profile dicts — the frontend's single
    source of truth for per-type range/arc/label (drag-preview rings, popups).
    No placement state; pure type definitions."""
⋮----
@app.post("/api/units")
def place_unit(req: PlaceUnitRequest) -> UnitContact
⋮----
# unit_type is a pydantic-validated UnitType enum, so the catalog lookup always hits.
contact = resolve_unit(req.unit_type.value).new_contact(req)
⋮----
@app.patch("/api/units/{unit_id}")
def update_unit(unit_id: str, req: UpdateUnitRequest) -> UnitContact
⋮----
contact = UNITS.get(unit_id)
⋮----
data = req.model_dump(exclude_none=True)
⋮----
@app.delete("/api/units/{unit_id}")
def delete_unit(unit_id: str) -> dict
⋮----
@app.delete("/api/units")
def clear_units(side: str | None = None) -> dict
⋮----
to_remove = [k for k, v in UNITS.items() if v.side.value == side]
⋮----
# ---- threat recompute ---------------------------------------------------------
⋮----
class PlacedEnemy(BaseModel)
⋮----
e: float
n: float
u: float
type: str = "sniper_op"  # sniper_op | tank | mortar (legacy; new flow uses /api/units)
⋮----
class RecomputeReq(BaseModel)
⋮----
enemies: list[PlacedEnemy] | None = None   # explicit override; omit to use /api/units store
friendly: list[list[float]] | None = None
⋮----
@app.post("/api/threat/recompute")
def recompute(req: RecomputeReq | None = None) -> dict
⋮----
"""Build the enemy laydown from operator-placed positions, then project the
    fires/observation fields (kill zones, danger). Reads from the /api/units store
    unless an explicit payload overrides it. Returns counts for the UI."""
from src.backend import fields, threat_template  # noqa: PLC0415
⋮----
# resolve enemies: explicit body > UNITS store
⋮----
enemies = [e.model_dump() for e in req.enemies]
⋮----
enemies = [
⋮----
# sniper_op is the legacy key threat_template expects; map sniper → sniper_op
⋮----
# operator-set heading — orients the sector of fire / kill zone (not the avenue)
⋮----
# intel quality — modulates risk-zone confidence in the projection
⋮----
friendly_pts: list[tuple[float, float, float]] | None = [
⋮----
friendly_pts = [
⋮----
n_friendly = len(friendly_pts) if friendly_pts else 0
⋮----
@app.post("/api/threat/reset")
def reset() -> dict
⋮----
"""Clear the laydown so the battlefield goes blank again (operator clear)."""
````

## File: src/frontend/src/components/Hud.tsx
````typescript
import { useState } from 'react'
import { BrickWall, Car, Container, House, Warehouse, type LucideIcon } from 'lucide-react'
import { CLASS_COLORS } from '../lib/colors'
import { useStore } from '../lib/store'
import { BoxClass, ColorMode } from '../lib/types'
⋮----
// object-class icons (coloured by CLASS_COLORS) — clearer than a plain swatch in the demo
⋮----
// base map appearance — always available
⋮----
// fires/threat analysis surfaces — all need the projected fields (place troops, then Scan)
⋮----
// "risk to" — which mover's surface to show (per-target-class risk)
⋮----
{ key: 'dismount', label: 'Infantry' },   // display label only; backend class key stays 'dismount'
⋮----
// risk-band legend (matches riskBand() in Viewer.ts)
⋮----
onClick=
````

## File: src/frontend/src/lib/types.ts
````typescript
export type BoxClass = 'car' | 'container' | 'wall' | 'house' | 'shelter'
⋮----
export interface CloudMeta {
  n: number
  origin: [number, number, number]
  span: [number, number, number]
}
⋮----
export type WorldCoordinate = [number, number, number]
⋮----
export interface BoundingBox {
  id: string
  name: string
  class_label: BoxClass
  center: [number, number, number]
  extent: [number, number, number]
  rotation: [number, number, number, number]
  avg_temperature: number
}
⋮----
export interface ViewshedInfo {
  observer_label: string
  observer_world: [number, number, number]
  params: {
    range_m: number
    arc_deg: number
    facing_deg: number
    eye_h: number
    target_h: number
    res_m: number
  }
  pct_points_visible: number
  cells_visible: number
}
⋮----
export type ThreatRole = 'observer' | 'anti_armor' | 'indirect'
export type ThreatType = 'sniper_op' | 'tank' | 'mortar'
⋮----
// ---- unified unit contact model (mirrors src/backend/units.py) ---------------
⋮----
export type UnitSide        = 'friendly' | 'hostile' | 'unknown'
export type UnitWeightClass = 'heavy' | 'medium' | 'light'
export type UnitType        = 'tank' | 'ifv' | 'apc' | 'assault' | 'sniper' | 'mortar' | 'at_team' | 'atgm_team'
export type UnitFireKind    = 'direct' | 'indirect' | 'observer'
export type UnitSource      = 'visual' | 'thermal' | 'reported' | 'sigint' | 'templated'
⋮----
/**
 * Doctrinal type definition (no placement/intel fields). Mirror of the backend's
 * `Unit.to_profile()` served at `GET /api/unit-profiles`. This is the frontend's
 * ONLY source of per-type range/arc/label — the drag-preview rings and popups
 * read from here, never from a hand-maintained duplicate.
 */
export interface UnitProfile {
  unit_type:    UnitType
  label:        string
  weight_class: UnitWeightClass
  role:         ThreatRole
  fire_kind:    UnitFireKind
  obs_arc:      number            // sector of observation, degrees
  eff_range_m:  number           // effective observation / engagement range, m
  max_range_m:  number           // maximum effective range, m
  height_agl_m: number           // sensor/eye height above local terrain
}
⋮----
obs_arc:      number            // sector of observation, degrees
eff_range_m:  number           // effective observation / engagement range, m
max_range_m:  number           // maximum effective range, m
height_agl_m: number           // sensor/eye height above local terrain
⋮----
export interface UnitContact {
  id:                string
  side:              UnitSide
  weight_class:      UnitWeightClass
  unit_type:         UnitType
  label:             string
  role:              ThreatRole
  fire_kind:         UnitFireKind
  world:             [number, number, number]   // UTM (E, N, elevation_m)
  confidence:        number
  sec_since_contact: number
  source:            UnitSource
  azimuth:           number | null
  obs_arc:           number
  eff_range_m:       number
  max_range_m:       number
  height_agl_m:      number
  velocity:          [number, number] | null
}
⋮----
world:             [number, number, number]   // UTM (E, N, elevation_m)
⋮----
export interface PlaceUnitRequest {
  side:       UnitSide
  unit_type:  UnitType
  world:      [number, number, number]
  azimuth:    number | null
  velocity:   [number, number] | null
  confidence?: number
  source?:    UnitSource
}
⋮----
export interface ThreatPosition {
  id: string
  role: ThreatRole
  type: ThreatType
  world: [number, number, number]
  facing_deg: number
  arc_deg: number
  score: number
  sees_pct_of_approach: number
  cover_dist_m: number
  height_above_ground_m: number
  thermal_cue: number
  defilade_m: number
}
⋮----
export interface ThreatInfo {
  side: string
  aa_points: number
  range_m: number
  avenue_source: string
  avenue: [number, number, number][]
  avenue_centroid: [number, number]
  positions: ThreatPosition[]
}
⋮----
export type RiskZone = 'kill_zone' | 'high' | 'moderate' | 'low'
⋮----
export interface SoldierExposure {
  world: [number, number, number]
  zone: RiskZone
  danger: number      // 0-255 risk cost at the soldier's spot
  depth: number       // overlapping fields of fire on the soldier
  exposed: boolean    // currently seen by ≥1 enemy
}
⋮----
danger: number      // 0-255 risk cost at the soldier's spot
depth: number       // overlapping fields of fire on the soldier
exposed: boolean    // currently seen by ≥1 enemy
⋮----
export interface FieldsInfo {
  side: string
  n_direct_shooters: number
  max_engagement_depth: number
  trps: [number, number][]
  pct_in_kill_zone: number
  soldiers?: SoldierExposure[]   // placed friendlies + their current risk zone (danger banner)
  note: string
}
⋮----
soldiers?: SoldierExposure[]   // placed friendlies + their current risk zone (danger banner)
⋮----
export type ColorMode = 'rgb' | 'height' | 'temperature' | 'viewshed' | 'threat' | 'pfatal' | 'depth' | 'risk'
export type LayerKey = 'points' | 'boxes' | 'observer' | 'threats' | 'viewcones'
export type Layers = Record<LayerKey, boolean>
export type ClassVisibility = Record<BoxClass, boolean>
export interface ScreenPoint {
  x: number
  y: number
}
export interface SceneCursor {
  screen: ScreenPoint
  world: WorldCoordinate
}
⋮----
export interface ViewshedResult {
  flags: Uint8Array
  info: ViewshedInfo
}
````

## File: src/frontend/src/lib/store.ts
````typescript
import { create } from 'zustand'
⋮----
import { BoundingBox, BoxClass, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, Layers, PlaceUnitRequest, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo } from './types'
⋮----
interface AppState {
  meta: CloudMeta | null
  boxes: BoundingBox[]
  viewshedInfo: ViewshedInfo | null
  viewshedReady: boolean
  threatInfo: ThreatInfo | null
  threatReady: boolean
  fieldsInfo: FieldsInfo | null
  fieldsReady: boolean
  loading: boolean
  error: string | null

  colorMode: ColorMode
  riskClass: 'dismount' | 'light_veh' | 'armour'   // who's moving — the risk surface to show
  overlayOnRgb: boolean
  layers: Layers
  classVisibility: ClassVisibility
  selected: BoundingBox | null
  selectedCursor: SceneCursor | null
  selectedThreat: ThreatPosition | null
  selectedThreatPoint: ScreenPoint | null
  selectedUnitId: string | null
  placing: 'enemy' | 'friendly' | null
  removing: boolean
  moving: boolean
  activeSide: 'hostile' | 'friendly'
  activeUnitType: UnitType
  units: UnitContact[]
  unitProfiles: UnitProfile[]
  scanning: boolean

  setData: (d: { meta: CloudMeta; boxes: BoundingBox[]; viewshedInfo: ViewshedInfo | null; threatInfo: ThreatInfo | null; fieldsInfo: FieldsInfo | null }) => void
  setReady: (r: { viewshedReady: boolean; threatReady: boolean; fieldsReady: boolean }) => void
  setViewshed: (viewshedInfo: ViewshedInfo) => void
  setError: (error: string) => void
  setColorMode: (colorMode: ColorMode) => void
  setRiskClass: (riskClass: 'dismount' | 'light_veh' | 'armour') => void
  setOverlayOnRgb: (overlayOnRgb: boolean) => void
  toggleLayer: (key: LayerKey) => void
  toggleClass: (key: BoxClass) => void
  select: (selected: BoundingBox | null, selectedCursor?: SceneCursor | null) => void
  selectThreat: (selectedThreat: ThreatPosition | null, selectedThreatPoint?: ScreenPoint | null) => void
  selectUnit: (id: string | null, cursor?: SceneCursor | null) => void
  setSelectedCursorScreen: (screen: ScreenPoint) => void
  focusWorld: ((world: [number, number, number]) => void) | null   // set by SceneCanvas → Viewer.focusWorld
  setPlacing: (placing: 'enemy' | 'friendly' | null) => void
  setRemoving: (removing: boolean) => void
  setMoving: (moving: boolean) => void
  setActiveSide: (side: 'hostile' | 'friendly') => void
  setActiveUnitType: (t: UnitType) => void
  setUnits: (units: UnitContact[]) => void
  setUnitProfiles: (profiles: UnitProfile[]) => void
  placeUnit: (req: PlaceUnitRequest) => Promise<void>
  removeUnit: (id: string) => Promise<void>
  clearUnits: (side: 'hostile' | 'friendly') => Promise<void>
  reorientUnit: (id: string, azimuth: number) => Promise<void>
  moveUnit: (id: string, world: [number, number, number]) => Promise<void>
  setScanning: (scanning: boolean) => void
}
⋮----
riskClass: 'dismount' | 'light_veh' | 'armour'   // who's moving — the risk surface to show
⋮----
focusWorld: ((world: [number, number, number]) => void) | null   // set by SceneCanvas → Viewer.focusWorld
⋮----
// Crossfire (depth) / P(fatal) / Risk read best painted onto the real map — force the RGB
// overlay on when entering them (the manual toggle was removed from the HUD).
````

## File: src/frontend/src/components/SceneCanvas.tsx
````typescript
import { useEffect, useRef } from 'react'
import { Viewer } from '../engine/Viewer'
import { useStore } from '../lib/store'
⋮----
/** Mounts the three.js engine once and forwards store changes to it. */
export default function SceneCanvas()
⋮----
// Sync from backend — picks up units added via the API without going through the UI.
// Only calls setUnits when the ID set changes so the auto-recompute doesn't fire spuriously.
⋮----
const onKey = (e: KeyboardEvent) =>
⋮----
// Auto-project the threat fields whenever the laydown changes — no explicit
// "analyse" step, no page reload. Debounced so rapid placements collapse into
// one run; single-flight (busy + dirty) so a change mid-run re-projects exactly
// once instead of overlapping backend file writes.
⋮----
const run = async () =>
⋮----
if (!s.units.some((u) => u.side === 'hostile')) return  // blank field — nothing to project (clean wipe is Reset)
⋮----
if (fl) await viewer.setRiskClass(st.riskClass)   // re-tint the Risk surface for the selected class
````

## File: src/frontend/src/engine/Viewer.ts
````typescript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { BoundingBox, ClassVisibility, CloudMeta, ColorMode, FieldsInfo, LayerKey, SceneCursor, ScreenPoint, ThreatInfo, ThreatPosition, UnitContact, UnitProfile, UnitType, ViewshedInfo, WorldCoordinate } from '../lib/types'
import ms from 'milsymbol'
import { CLASS_COLORS, TURBO } from '../lib/colors'
import { fetchCloud, fetchViewshed, fetchThreat, fetchDanger, fetchPfatal, fetchDepth, fetchReason, fetchConf } from '../lib/api'
import { v2w, w2v } from '../lib/utils'
⋮----
// NATO APP-6 / MIL-STD-2525 symbol codes (SIDC). Affiliation: H=hostile, F=friend.
// Both affiliations carry per-type icons so enemy and ally markers render with the
// same doctrinal shape — only affiliation colour (red/blue) differs.
⋮----
sniper_op: 'SHGPUCIS----',  // legacy key used by analyzed threat template
⋮----
ifv:       'SHGPUCIZ----',  // mechanized/armored infantry (UCAI is not a valid SIDC → renders as ?)
⋮----
at_team:   'SHGPUCIA----',  // infantry anti-armour (RPG/AT4)
atgm_team: 'SHGPUCIA----',  // anti-armour guided (Javelin)
⋮----
function sidcFor(unit: UnitContact): string
// ---- 3D unit models (meshopt-compressed GLB, served from /public/assets) ----
// One template is loaded+normalized per type, then cheaply .clone()d (shared
// geometry/material) for every placed contact.
⋮----
// On-map size (metres, longest axis). Oversized vs reality so units read as
// markers on a 1.2 km surface. ponytail: pure legibility knob — tune to taste.
⋮----
// Per-type forward correction (deg) added to the placement yaw. AI meshes don't
// share a forward axis, so each body's nose must be rotated onto the viewfield.
// Measured from the GLB bboxes: dismounts/teams point along local +Z (need 180°);
// the three vehicles point along local +X — their hull length runs X — so they
// need 90° to swing from broadside onto the heading.
// ponytail: if a vehicle ends up tail-first, flip that one 90 ↔ 270.
⋮----
// Load + normalize a type's model once: scale longest axis to MODEL_SIZE,
// centre on XZ, drop base to y=0. Returns a template to clone per placement.
function loadUnitModel(type: string): Promise<THREE.Object3D>
⋮----
// one CanvasTexture per SIDC, reused across markers
⋮----
function symbolTexture(sidc: string): THREE.Texture
⋮----
// Module-level cache: the 54 MB cloud is fetched at most once per page load,
// surviving React StrictMode double-mounts and component remounts.
⋮----
let dgFlags: Uint8Array | null = null   // planning cost (cover credit + kill-zone emphasis) — feeds Risk bands
let pfFlags: Uint8Array | null = null   // P(fatal enemy fire): true probability surface (its own color mode)
⋮----
let rsFlags: Uint8Array | null = null   // reason: 0 out-of-range 1 dead-ground 2 cover 3 exposed
let cfFlags: Uint8Array | null = null   // intel-confidence the cell is threatened (0-255)
// Risk-mode arrays for the currently-selected target class ("risk to" toggle). Default = the
// dismount arrays above; re-fetched per class on setRiskClass so danger/depth analyst modes stay put.
⋮----
// engagement-area depth palette: 0 dead · 1 single · 2 cross-fire · 3+ kill zone
⋮----
// RISK bands — a soldier-readable decomposition, thresholds tied to p_hit (danger byte D) and
// engagement depth K. Green is split by WHY it's safe (the canopy=concealment caveat). Returns
// sRGB colour + a base over-RGB alpha + whether it's a threat band (faded by intel confidence).
type RiskBand = { c: [number, number, number]; a: number; threat: boolean }
function riskBand(D: number, K: number, reason: number): RiskBand
⋮----
if (K >= 2 || D >= 204) return { c: [0.84, 0.10, 0.11], a: 0.85, threat: true }   // NO-GO / kill zone
if (D >= 128)           return { c: [0.94, 0.49, 0.12], a: 0.70, threat: true }   // HIGH  (p_hit≥0.5)
if (D >= 51 || K >= 1)  return { c: [0.99, 0.72, 0.15], a: 0.55, threat: true }   // MODERATE (seen / p_hit≥0.2)
if (reason === 2)       return { c: [0.36, 0.49, 0.63], a: 0.32, threat: false }  // LOW · behind cover (box)
if (reason === 1)       return { c: [0.45, 0.55, 0.49], a: 0.24, threat: false }  // LOW · dead ground (hidden, unverified)
return                         { c: [0.20, 0.52, 0.38], a: 0.20, threat: false }  // LOW · out of range
⋮----
// Doctrinal catalog fetched from /api/unit-profiles (backend units.UNIT_CATALOG).
// Used only for the drag-preview envelope shown between placement and the
// /api/units round-trip; once a UnitContact comes back, its own eff_range_m /
// obs_arc drive the persisted marker's range ring + sector wedge.
⋮----
// sRGB → linear transfer (IEC 61966-2-1). Vertex colours must be linear because
// the renderer re-encodes to sRGB on output.
const srgb2lin = (c: number)
⋮----
/**
 * The three.js world. Created once, driven imperatively. React never touches
 * the scene graph — it calls these methods and lets the engine own the WebGL
 * lifecycle (init, render loop, dispose).
 */
export class Viewer
⋮----
private colRGBArr?: Float32Array   // linear RGB base, for blending overlays onto the real map
⋮----
private static DRAG_PX = 6   // pointer travel below this is a click, not a drag
⋮----
constructor(private canvas: HTMLCanvasElement)
⋮----
// Lights only matter for the PBR unit models (cloud/boxes are unlit). Cool
// sky / warm key keeps the gunmetal+olive textures readable on the dark scene.
⋮----
const loop = () =>
⋮----
/** Fetch the cloud + viewshed + threat and build the whole scene. Idempotent. */
async load(meta: CloudMeta, boxes: BoundingBox[], vs: ViewshedInfo | null,
threat: ThreatInfo | null, fields: FieldsInfo | null): Promise<
⋮----
// The renderer outputs sRGB; vertex colours aren't auto-converted, so feed
// it linear. LUT maps the scan's 0-255 sRGB channels → linear once.
⋮----
// origin cancels out (served points are local): view = local - span/2
⋮----
// locate framing — close oblique "battle view". Tune to taste.
private static FOCUS_DIST = 280   // m from the soldier
private static FOCUS_PITCH = 38   // deg above the horizon (38 ≈ the oblique 3D look)
⋮----
/** Glide the camera to centre a world coord (E,N,U) at a fixed close oblique framing
   *  (FOCUS_DIST / FOCUS_PITCH), keeping the operator's current heading. Two-phase: the look
   *  rotates toward the soldier first, then the camera slides in to centre it. */
focusWorld(world: [number, number, number])
⋮----
// keep current heading (azimuth), override distance + pitch for the zoomed oblique view
⋮----
// Stepped from the render loop. Target leads (rotation first), camera follows on a delay
// (translation second), so the view turns toward the soldier and then slides over to centre it.
private stepFocus(dt: number)
⋮----
if (this.keys.size) { this.focusAnim = null; return }   // operator took manual control
⋮----
const easeOut = (x: number)
const easeInOut = (x: number)
const rot = easeOut(Math.min(1, a.t / 0.55))            // rotate toward soldier first
const mov = easeInOut(Math.max(0, (a.t - 0.35) / 0.65)) // then slide the camera over
⋮----
// Per-point overlay colours (viewshed/threat/danger/depth) from the module-cached
// flag buffers. Shared by the initial load() and setThreatFields() so a recompute
// re-tints without re-ingesting the 4M-point cloud.
private buildOverlayColors()
⋮----
colTH[i * 3] = srgb2lin(0.1) // cold = unlikely enemy position
⋮----
const c = TURBO(v) // turbo heatmap = how well the position dominates our approach
⋮----
const colPF = new Float32Array(n * 3) // P(fatal enemy fire) — continuous probability (turbo)
⋮----
const colDP = new Float32Array(n * 3) // engagement-area depth (overlapping fields of fire)
⋮----
rkD = dgFlags; rkK = dpFlags; rkR = rsFlags; rkC = cfFlags   // risk class defaults to dismount
⋮----
/** Refresh only the threat/danger/depth overlays after a recompute — no cloud
   *  re-ingest, no doubled geometry. Force-refetches the bins: the module flag
   *  cache is keyed per page-load, so a recompute must bypass it (this was the
   *  reason the old flow fell back to a full window.location.reload()). */
async setThreatFields(threat: ThreatInfo | null, fields: FieldsInfo | null, meta: CloudMeta)
⋮----
rsFlags = fields ? await fetchReason() : null   // refresh the risk surface on auto-project too
⋮----
this.clearGroup(this.threatGroup)   // drop old arrow before rebuilding (no doubling)
⋮----
this.setColorMode(this.colorMode)   // rebind the freshly built buffer to the geometry
⋮----
setColorMode(mode: ColorMode)
⋮----
// Build the (non-blended) RISK colour attribute from the current target-class arrays:
// danger+depth → band, reason → why-safe, confidence → fades the threat bands.
private buildRiskColors()
⋮----
/** "Risk for" toggle: re-fetch the per-class bins for whatever battlefield surface
   *  is currently active (risk / crossfire / probability of lethal fire) and repaint. */
async setRiskClass(cls: 'dismount' | 'light_veh' | 'armour')
⋮----
this.buildOverlayColors()      // rebuild pfatal/depth colours from the freshly fetched per-class bins (also resets rk arrays to dismount)
rkD = d; rkK = k; rkR = r; rkC = c   // override the risk arrays with the selected class's bins
⋮----
setOverlayOnRgb(on: boolean)
⋮----
// Composite a threat overlay over the real photographic colours: out = rgb*(1-a) + tint*a,
// where the tint's strength (a) scales with how "hot" the cell is. Lets you read the
// danger/kill-zone/viewshed on the actual map instead of a flat heatmap. Null = no overlay
// for this mode (rgb/height/temperature), so the pure attribute is used.
private blendedOverlay(mode: ColorMode): THREE.BufferAttribute | null
⋮----
// risk reads several arrays (for the selected target class), not one — handle it first
⋮----
} else { // threat / danger — turbo, strength = value
⋮----
setLayer(key: LayerKey, visible: boolean)
⋮----
// enemy markers now live in placedEnemyGroup (live /api/units); threatGroup holds only
// the advance-axis arrow. "hide enemy markers" should hide the actual enemy markers.
⋮----
setClassVisibility(visibility: ClassVisibility)
⋮----
setSelected(id: string | null)
⋮----
// Reveal a placed unit's full range ring/wedge only while it's selected.
setSelectedUnit(id: string | null)
⋮----
private updateSelectedUnitOverlays()
⋮----
setViewshed(flags: Uint8Array, info: ViewshedInfo)
⋮----
onPick(cb: (box: BoundingBox | null, cursor?: SceneCursor) => void)
⋮----
onPickThreat(cb: (p: ThreatPosition | null, point?:
⋮----
onCursorScreen(cb: (screen: ScreenPoint) => void)
⋮----
setCursorAnchor(world: WorldCoordinate | null)
⋮----
// ---- operator placement (enemy from intel, or our own positions) ----
setPlacing(mode: 'enemy' | 'friendly' | null)
⋮----
setRemoving(on: boolean)
⋮----
setMoving(on: boolean)
⋮----
setActiveUnitType(t: UnitType)
setActiveSide(s: 'hostile' | 'friendly')
⋮----
/** Receive the doctrinal catalog from /api/unit-profiles. Drag-preview rings
   *  for operator placement read range/arc from here, never from a hardcoded table. */
setUnitProfiles(profiles: UnitProfile[])
⋮----
private profileFor(t: UnitType): UnitProfile
⋮----
onPlaceFriendly(cb: (e: number, n: number, u: number, yaw_deg: number) => void)
⋮----
onPlaceEnemy(cb: (e: number, n: number, u: number, yaw_deg: number) => void)
⋮----
onRemoveUnit(cb: (id: string) => void)
onPickPlacedUnit(cb: (id: string, cursor: SceneCursor) => void)
onReorientUnit(cb: (id: string, azimuth: number) => void)
onMoveUnit(cb: (id: string, world: [number, number, number]) => void)
⋮----
setEnemyMarkers(units: UnitContact[])
⋮----
setFriendlyMarkers(units: UnitContact[])
⋮----
/** Builds a placed-contact marker — pole, NATO icon (azimuth-rotated), ground
   *  ring, and range/sector overlay. Enemy (red) and ally (blue) render with
   *  identical geometry; only affiliation colour differs, so both sides behave
   *  the same in the UI. */
private placeContacts(units: UnitContact[], side: 'hostile' | 'friendly', group: THREE.Group, color: number)
⋮----
// also remove this side's cones from the shared viewconesGroup
⋮----
// 3D body at ground level (visual only — icon/pole/ring stay the pick + tactical layer).
const place = (tmpl: THREE.Object3D) =>
⋮----
if (this.unitById.get(unit.id) !== unit) return  // removed or re-placed while loading
⋮----
private clearGroup(g: THREE.Group)
⋮----
// sprites share one module-level geometry — disposing it would churn every other sprite
⋮----
dispose()
⋮----
// ---- internals ----
⋮----
private buildBoxes(boxes: BoundingBox[], meta: CloudMeta)
⋮----
private updateBoxColors()
⋮----
// Likely enemy positions (threat template output) → distinct 3D assets:
// ◆ sniper/OP · ▮ tank · ⬢ mortar. The markers ARE the verification.
// Flat ground overlays (rings, sector wedges, crosshairs) must render ON TOP of the
// cloud — otherwise they sit at the scene's min elevation and get buried under the
// undulating terrain (only visible from underneath). depthTest off + high renderOrder.
private decal<T extends THREE.Mesh>(mesh: T): T
⋮----
// thetaStart maps compass yaw to THREE.CircleGeometry theta (0=east after rotation.x=-PI/2).
// `dir`: short facing cone (orientation + view angle) always shown for the RGB overview.
// `ranged`: full eff-range ring + wedge, revealed only when the unit is selected —
// the accurate engagement picture lives in danger/depth color modes.
private static DIR_R = 70 // m — glance-first facing cone, not the full weapon range
private rangeOverlay(
    vx: number, vy: number, vz: number, yaw_deg: number, profile: UnitProfile, color = 0xff2b2b,
):
⋮----
/** A billboarded NATO/APP-6 unit symbol — always faces the camera, always drawn on top. */
private symbolSprite(sidc: string, worldH = 14): THREE.Sprite
⋮----
private buildThreat(threat: ThreatInfo, meta: CloudMeta)
⋮----
// Enemy AND friendly unit markers (icon + pole + ring + range/sector overlay) are drawn
// from the live /api/units store by placeContacts(). The analysed laydown must NOT redraw
// them — doing so stacked a second marker on every unit after 'analyse' (the doubling bug).
// The only laydown-specific overlay left here is the advance-axis arrow; TRPs are drawn by
// buildTRPs(), the kill-zone/danger surface is the per-point colour overlay.
⋮----
const dir = new THREE.Vector3(-sx0, 0, -sz0).normalize() // toward objective (scene centre)
⋮----
private buildViewshedColors(flags: Uint8Array)
⋮----
colVS[i * 3] = srgb2lin(seen ? 1 : 0.12) // seen → red, dead ground → green
⋮----
private buildObserver(vs: ViewshedInfo, meta: CloudMeta)
⋮----
private clearObserver()
⋮----
// Only swallow keys while typing — a focused checkbox/button must not kill nav.
⋮----
// WASD/QE move position, arrows orient the camera.
⋮----
private apply(dt: number)
⋮----
// WASD/QE: pan camera + target together; speed scales with zoom.
private move(dt: number)
⋮----
// Use the camera's own right axis (matrix col 0) — robust even looking down,
// unlike crossing the look-dir with up (degenerate near top-down).
⋮----
// Arrows: look around in place — rotate the target about the camera (the
// camera is the pivot), so it feels like turning your head while flying.
private orient(dt: number)
⋮----
// camera stays put; target swings around it → look-in-place
⋮----
private resize()
⋮----
private emitCursorScreen()
⋮----
private toNDC(e: MouseEvent)
⋮----
private yawFromPinToViewer(vx: number, vz: number, hitX: number, hitZ: number)
⋮----
// north = -Z in viewer space; yaw = angle from north, clockwise
⋮----
// Intersect a horizontal plane at world-height vy — always hits unlike the sparse point cloud.
private groundHit(e: MouseEvent, vy: number): THREE.Vector3 | null
⋮----
// move mode: drag an existing icon to reposition it (keep its elevation)
⋮----
// reorient: drag from an existing icon or rotation handle (only when not in place/remove/move mode)
⋮----
// move drag: project pointer onto the unit's horizontal plane and translate
// the icon + pole + ring live; the backend PATCH fires on mouseup.
⋮----
// reorient drag: update the cone live while dragging from an icon/handle (only once it's a drag)
⋮----
// update the icon rotation live
⋮----
// update the view cone live
⋮----
private reorientJustFinished = false  // suppress onClick popup after drag
⋮----
if (moved < Viewer.DRAG_PX) return   // a click, not a drag → let onClick open the info panel
⋮----
if (moved < Viewer.DRAG_PX) return   // a click, not a drag → let onClick open the info panel
⋮----
// placement is handled by mousedown/move/up (drag-to-orient) for both sides — skip here
⋮----
// move mode: clicks do not open the info panel (drag repositions; click is a no-op)
⋮----
// reorient drag just finished — don't open popup on the icon that was dragged
⋮----
// a drag (camera orbit) also fires 'click' — ignore it so orbiting doesn't measure/select
⋮----
// remove mode: clicking a placed unit deletes it
⋮----
// placed operator units — click opens info popup anchored to world coord
⋮----
// enemy markers take priority over boxes
⋮----
private sceneCursor(e: MouseEvent, point: THREE.Vector3): SceneCursor
````
