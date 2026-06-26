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
