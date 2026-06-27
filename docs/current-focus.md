# Current Focus

## Where We Are

Foundation, concept docs, the FastAPI-backed viewer, the viewshed primitive, and
the full enemy-laydown → fires/observation projection pipeline are in place.

- [x] Data ingest and inspection: `io.py`, `inspect_ply.py`.
- [x] FastAPI backend: packs the cloud on startup, serves `/api/{meta,cloud,boxes}`, optional viewshed endpoints, and the unit/threat/fields endpoints.
- [x] React/Vite tactical viewer: point cloud, semantic boxes, rgb/height/temperature/viewshed/threat/danger/depth color modes, layer toggles, selected-object inspection, keyboard navigation, true 1:1 scale, plus operator unit placement and analyzed-laydown overlays.
- [x] Tactical concept docs: `THREAT_LIBRARY.md` for Red/OPFOR assets and `MANEUVER_ANALYSIS.md` for Blue maneuver outputs.
- [x] Slice 1 viewshed: `terrain.py` builds the DSM and stamps 58 box occluders; `visibility.py` computes radial LOS and writes `build/viewshed.*` for GIS and viewer overlay use.
- [x] **Doctrinal unit catalog** (`units.py`): single source of truth for tank/ifv/apc/assault/sniper/mortar (range, arc, role, fire kind, height AGL); served to the frontend via `GET /api/unit-profiles`.
- [x] **Operator-placed enemy laydown** (`threat_template.py`): operator marks where the enemy is; `POST /api/threat/recompute` turns marks into `build/threat.json`. No auto-templating.
- [x] **Fires/observation projection** (`fields.py`): range-graduated `p_hit`, per-asset sectors, engagement-area depth (kill zones at >=2 overlap), terrain-forced chokepoint TRPs, indirect = mortar range AND (observed OR TRP), cover reduction. Outputs `build/{danger,depth}.bin` + `fields_cost_*.tif` + `fields_depth.tif` + `fields.json`.
- [x] Interactive viewshed at cursor: `POST /api/viewshed` recomputes LOS at a clicked point (per-frame cursor projection in the viewer).

## Active Work

- The UI/UX refit toward a tactical C2 design philosophy continues (glance-first,
  honest uncertainty, semantic color, redundant shape/text encoding, spatial
  constancy, visible degraded/missing-data states, no hover-only critical
  controls). Recent additions: `FriendlyPanel` for unit placement + Analyze/Reset,
  `ThreatPanel` ranked enemy list, anchor-following `InfoPanelPopup` consumed by
  Object/Threat/PlacedUnit popups.
- Threat/fields overlays are per-session: the battlefield opens blank (terrain +
  object boxes only) and the operator places the enemy, then runs Analyze. `POST
  /api/threat/reset` and lifespan startup both wipe the laydown + projected
  artifacts via `clear_laydown()`.

## Next In Order

1. **Tactical C2 UI pass**: keep strengthening system-status and data-boundary treatment; ensure danger/depth color modes read clearly and degraded states (no laydown yet) are explicit.
2. **`landcover.py` vegetation mask**: derive concealment separately from hard cover so dead ground behind canopy is correctly tagged lower-confidence rather than treated as solid occlusion.
3. **`data/enemy_assets.json`**: finalize schema from `THREAT_LIBRARY.md` if a non-operator-templated fallback is still wanted (current flow is operator-placed only).
4. **`routes.py`**: least-cost approach, covered axis, bounds, chokepoints, dead ground, suppression priority, GO/NO-GO output — consumes the continuous cost surface from `fields.py`.
5. **Persistence of the unit-contact store**: currently in-memory and resets on server restart; decide whether session persistence or a snapshot is needed.

## Open Questions

- Is there a second temporal pass? Without it, Track 2 change detection remains blocked.
- What exactly counts as a sponsor/operator-good output in under 10 seconds? This gates risk weights and what the UI should escalate.
- What confidence vocabulary should be standardized across operator-placed Red positions, thermal cues, stale viewshed/fields products, and missing sensors?
- Should the indirect-fire model grow beyond mortar range ∩ (observed ∪ TRP) — e.g. time-of-flight, ammo resupply, or counter-battery risk?

## Notes

- Single-pass thermal cueing remains valuable: warm structures from `avg_temperature` can raise suspected OP/weapon likelihood without claiming confirmation.
- Generated `build/` layers are absent until scripts/endpoints run; the UI must represent this as unavailable/degraded data, not as an empty or silently disabled state.
- `fields.py` recomputes the DSM internally via `build_dsm()`; `app.py` caches terrain by `res_m` in `TERRAIN` but `fields.run()` does not yet reuse that cache.
- `src/frontend/.vite/` appeared in the latest repomix output but is generated cache and should be ignored architecturally. A stale `docs/repo-context.md` is also present; `.docs/repo-context.md` is the current generated dump.
