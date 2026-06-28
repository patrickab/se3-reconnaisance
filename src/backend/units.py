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

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import random
import uuid

from pydantic import BaseModel, Field


class Side(str, Enum):
    friendly = "friendly"
    hostile  = "hostile"
    unknown  = "unknown"


class WeightClass(str, Enum):
    heavy  = "heavy"
    medium = "medium"
    light  = "light"


class UnitType(str, Enum):
    tank      = "tank"
    ifv       = "ifv"
    apc       = "apc"
    assault   = "assault"
    sniper    = "sniper"
    mortar    = "mortar"
    at_team   = "at_team"      # dismounted short-range anti-armour (RPG-7 / AT4)
    atgm_team = "atgm_team"    # dismounted long-range guided anti-armour (Javelin / Kornet)


class FireKind(str, Enum):
    """How this unit delivers effect — gates which threat-field pass projects it."""
    direct   = "direct"    # line-of-sight weapon (tank, IFV, sniper)
    indirect = "indirect"  # indirect fire (mortar/howitzer)
    observer = "observer"  # no organic fires; observation only


class ThreatRole(str, Enum):
    """Tactical role in the IPB fires-and-observation overlay."""
    observer   = "observer"
    anti_armor = "anti_armor"
    indirect   = "indirect"


class Source(str, Enum):
    visual    = "visual"
    thermal   = "thermal"
    reported  = "reported"
    sigint    = "sigint"
    templated = "templated"


class TargetClass(str, Enum):
    """Who is moving through the threat — each sees a different risk surface."""
    dismount  = "dismount"     # exposed personnel on foot   (LOS height 1.7 m)
    light_veh = "light_veh"    # soft / light vehicle        (LOS height 2.5 m)
    armour    = "armour"       # IFV / MBT                   (LOS height 2.5 m)


# LOS (target) height per class — drives which viewshed height is used. light_veh and
# armour share 2.5 m so the viewshed is still only ever evaluated at two heights.
TARGET_HEIGHT_M: dict[str, float] = {"dismount": 1.7, "light_veh": 2.5, "armour": 2.5}


class UpdateUnitRequest(BaseModel):
    """Partial update — only supplied fields are applied."""
    azimuth:    float | None = None
    world:      tuple[float, float, float] | None = None
    confidence: float | None = None


class PlaceUnitRequest(BaseModel):
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


class UnitContact(BaseModel):
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


@dataclass
class Unit:
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

    def new_contact(self, req: PlaceUnitRequest) -> UnitContact:
        return UnitContact(
            side              = req.side,
            weight_class      = self.weight_class,
            unit_type         = self.unit_type,
            label             = self.label,
            role              = self.role,
            fire_kind         = self.fire_kind,
            world             = req.world,
            confidence        = req.confidence,
            sec_since_contact = round(random.uniform(0, 15), 1),
            source            = req.source,
            azimuth           = req.azimuth,
            obs_arc           = self.obs_arc,
            weapon_arc        = self.weapon_arc,
            eff_range_m       = self.eff_range_m,
            max_range_m       = self.max_range_m,
            min_range_m       = self.min_range_m,
            height_agl_m      = self.height_agl_m,
            velocity          = req.velocity,
        )

    def to_profile(self) -> dict:
        """Lightweight dict for ``GET /api/unit-profiles`` — UI drag-preview + popups
        read range/arc/label; ``eff`` lets the UI flag what each unit threatens."""
        return {
            "unit_type":    self.unit_type.value,
            "label":        self.label,
            "weight_class": self.weight_class.value,
            "role":         self.role.value,
            "fire_kind":    self.fire_kind.value,
            "obs_arc":      self.obs_arc,
            "weapon_arc":   self.weapon_arc,
            "eff_range_m":  self.eff_range_m,
            "max_range_m":  self.max_range_m,
            "min_range_m":  self.min_range_m,
            "height_agl_m": self.height_agl_m,
            "eff":          self.eff,
        }


# Canonical doctrinal defaults — sourced (see docs/ANALYSIS_LAYER.md "Unit & weapon realism";
# NATO + OPFOR open-source specs, fires doctrine, ballistics). obs_arc = observation sector
# (wide), weapon_arc = lethal sector of fire (narrow, on heading). eff = P(kill|hit) per class.
def _eff(dismount: float, light_veh: float, armour: float) -> dict[str, float]:
    return {"dismount": dismount, "light_veh": light_veh, "armour": armour}


UNIT_CATALOG: dict[str, Unit] = {
    "tank": Unit(
        unit_type=UnitType.tank,    weight_class=WeightClass.heavy,  label="Main Battle Tank",
        role=ThreatRole.anti_armor, fire_kind=FireKind.direct,
        obs_arc=120, weapon_arc=90, eff_range_m=2200, max_range_m=2500, min_range_m=0, height_agl_m=2.5,
        ph_p0=0.98, ph_shoulder=1.36, ph_beta=9.0, supp_s0=0.20, eff=_eff(0.80, 0.95, 0.95),  # 120 mm APFSDS, FCS
    ),
    "ifv": Unit(
        unit_type=UnitType.ifv,     weight_class=WeightClass.heavy,  label="Infantry Fighting Veh.",
        role=ThreatRole.anti_armor, fire_kind=FireKind.direct,
        obs_arc=120, weapon_arc=90, eff_range_m=1500, max_range_m=2500, min_range_m=0, height_agl_m=2.5,
        ph_p0=0.90, ph_shoulder=1.00, ph_beta=4.0, supp_s0=0.50, eff=_eff(0.90, 0.85, 0.35),  # autocannon (+ATGM)
    ),
    "apc": Unit(
        unit_type=UnitType.apc,     weight_class=WeightClass.medium, label="Armoured Transporter",
        role=ThreatRole.observer,   fire_kind=FireKind.direct,
        obs_arc=270, weapon_arc=90, eff_range_m=1500, max_range_m=2000, min_range_m=0, height_agl_m=2.0,
        ph_p0=0.70, ph_shoulder=0.63, ph_beta=2.4, supp_s0=0.65, eff=_eff(0.95, 0.65, 0.10),  # .50 HMG; rear blind spot
    ),
    "assault": Unit(
        unit_type=UnitType.assault, weight_class=WeightClass.light,  label="Assault Troops",
        role=ThreatRole.observer,   fire_kind=FireKind.direct,
        obs_arc=270, weapon_arc=180, eff_range_m=500, max_range_m=700, min_range_m=0, height_agl_m=1.5,
        ph_p0=0.95, ph_shoulder=0.90, ph_beta=2.2, supp_s0=0.35, eff=_eff(0.85, 0.10, 0.00),  # 5.56 rifle; assigned sector, rear blind
    ),
    "sniper": Unit(
        unit_type=UnitType.sniper,  weight_class=WeightClass.light,  label="Sniper / OP",
        role=ThreatRole.observer,   fire_kind=FireKind.direct,
        obs_arc=200, weapon_arc=45, eff_range_m=1000, max_range_m=1300, min_range_m=0, height_agl_m=1.7,
        ph_p0=0.97, ph_shoulder=1.19, ph_beta=8.0, supp_s0=0.0, eff=_eff(0.90, 0.10, 0.00),  # 7.62 bolt/DMR; scans a sector
    ),
    "mortar": Unit(
        unit_type=UnitType.mortar,  weight_class=WeightClass.light,  label="Mortar Team",
        role=ThreatRole.indirect,   fire_kind=FireKind.indirect,
        # indirect: no sector of fire; covers a range ANNULUS (min_range dead zone → max), gated by
        # observation / pre-registered TRPs in fields.py. Hill params unused (area path, CEP-driven).
        obs_arc=0, weapon_arc=360, eff_range_m=7000, max_range_m=7000, min_range_m=200, height_agl_m=1.5,
        ph_p0=0.0, ph_shoulder=1.0, ph_beta=2.0, supp_s0=0.0, eff=_eff(0.75, 0.45, 0.05),  # 120 mm
    ),
    "at_team": Unit(
        unit_type=UnitType.at_team, weight_class=WeightClass.light,  label="AT Team (RPG)",
        role=ThreatRole.anti_armor, fire_kind=FireKind.direct,
        obs_arc=180, weapon_arc=90, eff_range_m=400, max_range_m=800, min_range_m=20, height_agl_m=1.5,
        ph_p0=0.85, ph_shoulder=0.87, ph_beta=2.0, supp_s0=0.10, eff=_eff(0.55, 0.85, 0.70),  # RPG-7 / AT4
    ),
    "atgm_team": Unit(
        unit_type=UnitType.atgm_team, weight_class=WeightClass.light, label="ATGM Team (Javelin)",
        role=ThreatRole.anti_armor,   fire_kind=FireKind.direct,
        obs_arc=180, weapon_arc=90, eff_range_m=2500, max_range_m=4000, min_range_m=65, height_agl_m=1.5,
        ph_p0=0.90, ph_shoulder=1.20, ph_beta=12.0, supp_s0=0.0, eff=_eff(0.40, 0.90, 0.95),  # top-attack guided
    ),
}

# Legacy alias used by the analyzed-threat template (docs/THREAT_LIBRARY.md).
# ``sniper_op`` was the historical key for an OP-positioned sniper; canonical
# type is ``sniper``. Resolving through this alias keeps the threat-template
# pipeline consistent with the unit catalog.
_ALIAS: dict[str, str] = {"sniper_op": "sniper"}


def resolve_unit(key: str) -> Unit | None:
    """Resolve a catalog key or legacy alias (e.g. ``sniper_op``) to a :class:`Unit`."""
    return UNIT_CATALOG.get(_ALIAS.get(key, key))


def unit_profiles() -> list[dict]:
    """Catalog as a list of profile dicts — serialised by ``GET /api/unit-profiles``."""
    return [u.to_profile() for u in UNIT_CATALOG.values()]
