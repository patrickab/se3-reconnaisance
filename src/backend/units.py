"""Unit primitives — the shared contact model for all battlefield actors.

A :class:`Unit` is a static doctrinal type definition (sensor/weapon envelope).
A :class:`UnitContact` is a placed instance with position and intelligence quality
fields. :class:`PlaceUnitRequest` is the thin POST body; the backend fills in
doctrinal defaults from :data:`UNIT_CATALOG`.

The catalog is the **single source of truth** for per-type properties. Both the
analysis chain (``threat_template``, ``fields``) and the frontend (via
``GET /api/unit-profiles``) read from it; neither side keeps its own copy.
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
    tank    = "tank"
    ifv     = "ifv"
    apc     = "apc"
    assault = "assault"
    sniper  = "sniper"
    mortar  = "mortar"


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
    obs_arc:           float        # sector of observation, degrees, centred on azimuth
    eff_range_m:       float        # effective observation / engagement range, m
    max_range_m:       float        # maximum effective range (fades to ~0.2 P(hit) past eff_range_m)
    height_agl_m:      float        # sensor/eye height above local terrain (AGL, not sea level)
    velocity:          tuple[float, float] | None = None


@dataclass
class Unit:
    """Static type definition — doctrinal sensor/weapon envelope.

    Not a contact; no position or intelligence fields.
    """
    unit_type:    UnitType
    weight_class: WeightClass
    label:        str
    role:         ThreatRole
    fire_kind:    FireKind
    obs_arc:      float           # sector of observation, degrees
    eff_range_m:  float           # effective observation / engagement range, m
    max_range_m:  float           # maximum range (fades past eff_range_m)
    height_agl_m: float           # sensor/eye height above local terrain

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
            eff_range_m       = self.eff_range_m,
            max_range_m       = self.max_range_m,
            height_agl_m      = self.height_agl_m,
            velocity          = req.velocity,
        )

    def to_profile(self) -> dict:
        """Lightweight dict for ``GET /api/unit-profiles`` — UI drag-preview needs
        only the keys it actually reads (range/arc/label)."""
        return {
            "unit_type":    self.unit_type.value,
            "label":        self.label,
            "weight_class":  self.weight_class.value,
            "role":         self.role.value,
            "fire_kind":    self.fire_kind.value,
            "obs_arc":      self.obs_arc,
            "eff_range_m":  self.eff_range_m,
            "max_range_m":  self.max_range_m,
            "height_agl_m": self.height_agl_m,
        }


# Canonical doctrinal defaults.
#
# Field sources (reconciled against docs/THREAT_LIBRARY.md):
#  - obs_arc / eff_range_m / height_agl_m : previously in this catalog; kept.
#  - max_range_m / fire_kind / role       : previously duplicated in fields.PROFILES
#                                            and threat_template.{ARC,ROLE}; now here.
#  - mortar.eff_range_m != max_range_m    : eff ~ minimum-range buffer; max ~ charge table.
UNIT_CATALOG: dict[str, Unit] = {
    "tank": Unit(
        unit_type=UnitType.tank,    weight_class=WeightClass.heavy,  label="Main Battle Tank",
        role=ThreatRole.anti_armor, fire_kind=FireKind.direct,
        obs_arc=110, eff_range_m=1800, max_range_m=2500, height_agl_m=2.5,
    ),
    "ifv": Unit(
        unit_type=UnitType.ifv,     weight_class=WeightClass.heavy,  label="Infantry Fighting Veh.",
        role=ThreatRole.anti_armor, fire_kind=FireKind.direct,
        obs_arc=110, eff_range_m=1500, max_range_m=2000, height_agl_m=2.5,
    ),
    "apc": Unit(
        unit_type=UnitType.apc,     weight_class=WeightClass.medium, label="Armoured Transporter",
        role=ThreatRole.observer,  fire_kind=FireKind.direct,
        obs_arc=180, eff_range_m=1200, max_range_m=1500, height_agl_m=2.0,
    ),
    "assault": Unit(
        unit_type=UnitType.assault, weight_class=WeightClass.light,  label="Assault Troops",
        role=ThreatRole.observer,   fire_kind=FireKind.direct,
        obs_arc=180, eff_range_m=300,  max_range_m=400,  height_agl_m=1.5,
    ),
    "sniper": Unit(
        unit_type=UnitType.sniper,  weight_class=WeightClass.light,  label="Sniper / OP",
        role=ThreatRole.observer,   fire_kind=FireKind.direct,
        obs_arc=60,  eff_range_m=800,  max_range_m=1300, height_agl_m=1.7,
    ),
    "mortar": Unit(
        unit_type=UnitType.mortar,  weight_class=WeightClass.light,  label="Mortar Team",
        role=ThreatRole.indirect,   fire_kind=FireKind.indirect,
        # indirect fire: sector-of-fire is meaningless, observer gating is handled by fields.py
        obs_arc=0,   eff_range_m=7000, max_range_m=7000, height_agl_m=1.5,
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
