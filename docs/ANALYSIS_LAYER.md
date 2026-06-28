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
