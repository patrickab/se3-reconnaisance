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
