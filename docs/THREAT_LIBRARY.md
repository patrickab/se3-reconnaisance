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
