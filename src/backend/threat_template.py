"""Enemy laydown — built from OPERATOR-placed positions (real intel), not auto-templated.

The operator (with the soldiers) marks where the enemy actually is on the map; we turn
those marks into a structured laydown that fields.py then projects into fields of fire,
engagement-area depth (kill zones) and the danger surface. No guessing where the enemy
might be — the human provides ground truth, the system does the spatial reasoning.

Called from /api/threat/recompute with the placed enemies (and optionally our own
positions, which the shooters are oriented onto).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from src.backend.io import read_ply  # noqa: E402
from src.backend.terrain import BUILD, DATA  # noqa: E402
from src.backend.units import resolve_unit  # noqa: E402


def from_manual(enemies: list[dict], friendly: list[tuple[float, float, float]] | None = None) -> dict:
    """enemies: [{e,n,u,type}] (type ∈ sniper_op|tank|mortar|...). friendly: [[E,N,U]] (optional).

    Writes build/threat.json — the laydown fields.py projects. Direct-fire shooters are
    oriented onto our positions if given, else toward the scene centre. Per-type arc
    and role come from the unit catalog (single source of truth, units.py).
    """
    v = read_ply(DATA / "point_cloud.ply")
    x, y = np.asarray(v["x"]), np.asarray(v["y"])
    if friendly:
        fx = float(np.mean([f[0] for f in friendly]))
        fy = float(np.mean([f[1] for f in friendly]))
    else:
        fx, fy = (float(x.min()) + float(x.max())) / 2, (float(y.min()) + float(y.max())) / 2

    positions = []
    for i, en in enumerate(enemies):
        E, N, U, typ = float(en["e"]), float(en["n"]), float(en["u"]), str(en["type"])
        unit = resolve_unit(typ)
        role = unit.role.value if unit else "observer"
        arc = unit.obs_arc if unit else 0
        facing = 0.0 if role == "indirect" else float(math.degrees(math.atan2(fy - N, fx - E)))
        positions.append({
            "id": f"red_{i}", "role": role, "type": typ,
            "world": [round(E, 1), round(N, 1), round(U, 1)],
            "facing_deg": round(facing, 0), "arc_deg": arc,
            "score": 1.0, "sees_pct_of_approach": 0, "cover_dist_m": 0,
            "height_above_ground_m": 0, "thermal_cue": 0, "defilade_m": 0,
        })

    info = {
        "side": "manual", "aa_points": len(friendly or []), "range_m": 0,
        "avenue_source": "operator",
        "avenue": [[round(f[0], 1), round(f[1], 1), round(f[2], 1)] for f in (friendly or [])],
        "avenue_centroid": [round(fx, 1), round(fy, 1)],
        "positions": positions,
    }
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / "threat.json").write_text(json.dumps(info))
    print(f"manual laydown: {len(positions)} enemy positions, {len(friendly or [])} friendly")
    return info


def main() -> None:
    print("threat_template builds laydowns from operator-placed enemies — see from_manual(), "
          "driven by the app's /api/threat/recompute endpoint.")


if __name__ == "__main__":
    main()
