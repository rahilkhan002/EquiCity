"""
DRI Engine — computes the three-pillar Displacement Risk Index.

DRI(i,t) = 100 * [0.35*S_norm + 0.40*M_norm + 0.25*V_norm]
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorDatabase

from .spatial_service import compute_min_distance_meters
from .uncertainty import classify_data_quality, build_uncertainty_label, _tier_label

LIFECYCLE_MULTIPLIERS = {
    "Proposed": 0.50,
    "Approved": 0.85,
    "Under Construction": 1.00,
    "Completed": 0.90,
}
MAX_BUFFER_M = 2000.0
DECAY_LAMBDA = 0.0012

# ─────────────────────────── Pillar S ───────────────────────────

def compute_s_raw(tract_geom: dict, projects: List[dict]) -> float:
    """Spatial Green Exposure (unnormalized 0–∞)."""
    total = 0.0
    for proj in projects:
        d = compute_min_distance_meters(tract_geom, proj["geometry"])
        if d > MAX_BUFFER_M:
            continue
        psi = LIFECYCLE_MULTIPLIERS.get(proj.get("lifecycle_stage", "Proposed"), 0.50)
        budget = proj.get("capital_budget_usd", 1_000_000)
        log_budget = math.log1p(budget / 1_000_000)
        decay = math.exp(-DECAY_LAMBDA * d)
        total += psi * log_budget * decay
    return total

def normalize_s(raw: float, city_max: float) -> float:
    if city_max <= 0:
        return 0.0
    return min(raw / city_max, 1.0)

# ─────────────────────────── Pillar M ───────────────────────────

def sigmoid_z(value: float, mean: float, std: float) -> float:
    """Sigmoid-normalized Z-score → [0,1]."""
    if std == 0:
        return 0.5
    z = (value - mean) / std
    return 1.0 / (1.0 + math.exp(-z))

def compute_m_components(events: List[dict], now: datetime) -> Dict[str, Any]:
    """
    Compute market velocity sub-components from raw market events.
    Returns dict with component values and observation stats.
    """
    cutoff_180 = now - timedelta(days=180)
    cutoff_90  = now - timedelta(days=90)

    rent_events_180 = [e for e in events
                       if e["event_type"] == "rent_listing"
                       and e["event_date"] >= cutoff_180
                       and e.get("asking_rent_usd") and e.get("unit_sqm")]

    rent_events_90  = [e for e in events
                       if e["event_type"] == "rent_listing"
                       and e["event_date"] >= cutoff_90
                       and e.get("asking_rent_usd") and e.get("unit_sqm")]

    eviction_events_180 = [e for e in events
                           if e["event_type"] == "eviction_filing"
                           and e["event_date"] >= cutoff_180]

    flip_events_180 = [e for e in events
                       if e["event_type"] == "property_flip"
                       and e["event_date"] >= cutoff_180
                       and (e.get("hold_days") or 9999) < 730]

    rir_events_90 = [e for e in events
                     if e["event_type"] in ("rent_listing", "rent_payment")
                     and e["event_date"] >= cutoff_90
                     and e.get("asking_rent_usd") and e.get("household_income_usd")]

    pir_events_180 = [e for e in events
                      if e["event_type"] == "property_flip"
                      and e["event_date"] >= cutoff_180
                      and e.get("sale_price_usd") and e.get("household_income_usd")]

    # Rent growth (180d vs 90d median rent/sqm)
    def med_rent_per_sqm(ev):
        vals = [e["asking_rent_usd"] / e["unit_sqm"] for e in ev]
        return sorted(vals)[len(vals)//2] if vals else None

    rent_180 = med_rent_per_sqm(rent_events_180)
    rent_90  = med_rent_per_sqm(rent_events_90)
    rent_growth = ((rent_90 - rent_180) / rent_180) if (rent_180 and rent_90 and rent_180 > 0) else 0.0

    # RIR (Rent-to-Income) 90d
    rir_vals = [(e["asking_rent_usd"] * 12) / e["household_income_usd"]
                for e in rir_events_90 if e["household_income_usd"] > 0]
    median_rir = sorted(rir_vals)[len(rir_vals)//2] if rir_vals else 0.0

    # PIR (Price-to-Income) 180d
    pir_vals = [e["sale_price_usd"] / e["household_income_usd"]
                for e in pir_events_180 if e["household_income_usd"] > 0]
    median_pir = sorted(pir_vals)[len(pir_vals)//2] if pir_vals else 0.0

    # Turnover per 1000 units (evictions + speculative flips)
    eviction_count = sum(e.get("eviction_count", 1) for e in eviction_events_180)
    flip_count     = len(flip_events_180)

    # Observation stats
    all_dates = [e["event_date"] for e in events]
    obs_count = len(events)
    if all_dates:
        span_days = (max(all_dates) - min(all_dates)).days
        days_since_latest = (now - max(all_dates)).days
    else:
        span_days = 0
        days_since_latest = 999

    return {
        "rent_growth": rent_growth,
        "median_rir": median_rir,
        "median_pir": median_pir,
        "eviction_count": eviction_count,
        "flip_count": flip_count,
        "obs_count": obs_count,
        "span_days": span_days,
        "days_since_latest": days_since_latest,
    }

def compute_m_norm(components: dict, city_stats: dict) -> float:
    """
    Combine M sub-components into M_norm ∈ [0,1].
    Sub-weights: rent_growth 45%, tenure_burden 30%, turnover 25%.
    """
    cstats = city_stats

    rg_norm  = sigmoid_z(components["rent_growth"],
                         cstats.get("mean_rent_growth", 0.05),
                         cstats.get("std_rent_growth", 0.08))

    # Tenure burden: combine RIR and PIR
    rir_norm = sigmoid_z(components["median_rir"],
                         cstats.get("mean_rir", 0.35),
                         cstats.get("std_rir", 0.15))
    pir_norm = sigmoid_z(components["median_pir"],
                         cstats.get("mean_pir", 10.0),
                         cstats.get("std_pir", 4.0))
    burden_norm = 0.6 * rir_norm + 0.4 * pir_norm

    evict_rate = components["eviction_count"] / max(components.get("unit_count", 100), 1) * 1000
    flip_rate  = components["flip_count"] / max(components.get("unit_count", 100), 1) * 1000
    turnover   = evict_rate + flip_rate
    turn_norm  = sigmoid_z(turnover,
                           cstats.get("mean_turnover", 5.0),
                           cstats.get("std_turnover", 3.0))

    return 0.45 * rg_norm + 0.30 * burden_norm + 0.25 * turn_norm

# ─────────────────────────── Pillar V ───────────────────────────

def compute_v_norm(tract: dict) -> float:
    """
    Socio-Economic Baseline Vulnerability (0–1).
    low_income_share 40%, renter_share 35%, rent_burdened_share 25%.
    """
    li  = min(tract.get("low_income_share", 0.0), 1.0)
    rs  = min(tract.get("renter_share", 0.0), 1.0)
    rbs = min(tract.get("rent_burdened_share", 0.0), 1.0)
    return 0.40 * li + 0.35 * rs + 0.25 * rbs

# ─────────────────────────── Main DRI ───────────────────────────

async def compute_dri(
    tract: dict,
    db: AsyncIOMotorDatabase,
    city_stats: Optional[dict] = None,
    city_s_max: Optional[float] = None,
) -> dict:
    """Full DRI computation for one tract."""
    from ..database import get_db
    _db = db or get_db()

    now = datetime.utcnow()

    # Fetch green projects in the city
    projects = await _db.green_projects.find({"city": tract["city"]}).to_list(length=500)

    # Pillar S
    s_raw = compute_s_raw(tract["geometry"], projects)
    if city_s_max is None:
        city_s_max = s_raw  # fallback; caller should pass city max
    s_norm = normalize_s(s_raw, city_s_max)

    # Fetch market events for this tract
    events = await _db.market_events.find(
        {"tract_id": tract["tract_id"]}
    ).sort("event_date", -1).to_list(length=5000)

    # Convert event_date to datetime if stored as string
    for e in events:
        if isinstance(e.get("event_date"), str):
            from datetime import datetime as dt
            e["event_date"] = dt.fromisoformat(e["event_date"])

    mc = compute_m_components(events, now)
    mc["unit_count"] = tract.get("total_population", 100) // 3  # rough estimate

    if city_stats is None:
        city_stats = _default_city_stats()

    m_norm = compute_m_norm(mc, city_stats)

    # Pillar V
    v_norm = compute_v_norm(tract)

    # DRI
    dri = 100.0 * (0.35 * s_norm + 0.40 * m_norm + 0.25 * v_norm)
    dri = round(min(max(dri, 0.0), 100.0), 2)

    # Data quality
    dq = classify_data_quality(mc["obs_count"], mc["span_days"], mc["days_since_latest"])

    # Uncertainty bounds (vary M from 0 to 1)
    if dq != "VERIFIED":
        dri_low  = 100.0 * (0.35 * s_norm + 0.40 * 0.0 + 0.25 * v_norm)
        dri_high = 100.0 * (0.35 * s_norm + 0.40 * 1.0 + 0.25 * v_norm)
        from .uncertainty import build_uncertainty_label
        uncertainty_label = build_uncertainty_label(dq, dri_low, dri_high)
        dri_range = f"{dri_low:.1f}–{dri_high:.1f}"
    else:
        uncertainty_label = _tier_label(dri)
        dri_range = None

    return {
        "tract_id": tract["tract_id"],
        "name": tract["name"],
        "city": tract["city"],
        "dri_score": dri,
        "risk_tier": _tier_label(dri),
        "data_quality": dq,
        "uncertainty_label": uncertainty_label,
        "dri_range": dri_range,
        "s_norm": round(s_norm, 4),
        "m_norm": round(m_norm, 4),
        "v_norm": round(v_norm, 4),
        "s_raw": round(s_raw, 4),
        "computed_at": now.isoformat(),
    }

def _default_city_stats() -> dict:
    return {
        "mean_rent_growth": 0.05, "std_rent_growth": 0.08,
        "mean_rir": 0.35, "std_rir": 0.15,
        "mean_pir": 10.0, "std_pir": 4.0,
        "mean_turnover": 5.0, "std_turnover": 3.0,
    }
