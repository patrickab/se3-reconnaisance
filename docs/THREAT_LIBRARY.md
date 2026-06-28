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
