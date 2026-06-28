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
