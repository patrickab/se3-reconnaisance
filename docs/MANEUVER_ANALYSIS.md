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
