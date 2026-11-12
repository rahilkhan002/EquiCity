"""
Mode A: What-If Pre-Construction Simulator
Ceteris Paribus Decomposition — holds M and V constant, varies S.
"""
import math
from typing import List
from .spatial_service import buffer_polygon_meters, compute_min_distance_meters, polygon_intersects
from .dri_engine import LIFECYCLE_MULTIPLIERS, DECAY_LAMBDA, MAX_BUFFER_M, _tier_label

LIFECYCLE_MULTIPLIERS_SIM = {
    "Proposed": 0.50,
    "Approved": 0.85,
    "Under Construction": 1.00,
    "Completed": 0.90,
}

def simulate_project_impact(
    proposed_geometry: dict,
    capital_budget_usd: float,
    lifecycle_stage: str,
    affected_tracts: List[dict],  # tracts with current dri fields
) -> List[dict]:
    """
    For each affected tract, compute delta-DRI if the proposed project is added.
    Returns list of impact records sorted by delta_dri desc.
    """
    psi = LIFECYCLE_MULTIPLIERS_SIM.get(lifecycle_stage, 0.50)
    log_budget = math.log1p(capital_budget_usd / 1_000_000)

    results = []
    for tract in affected_tracts:
        d = compute_min_distance_meters(tract["geometry"], proposed_geometry)
        if d > MAX_BUFFER_M:
            continue
        decay = math.exp(-DECAY_LAMBDA * d)
        delta_s_raw = psi * log_budget * decay

        # Normalize delta_s using existing s_raw + city_s_max approximation
        # We use a simple proportional bump
        city_s_max = max(tract.get("s_raw", 0.0), delta_s_raw, 0.001)
        old_s_norm = tract.get("s_norm", 0.0)
        new_s_norm = min(old_s_norm + (delta_s_raw / city_s_max) * (1 - old_s_norm), 1.0)

        m_norm = tract.get("m_norm", 0.0)
        v_norm = tract.get("v_norm", 0.0)

        old_dri = tract.get("dri_score", 0.0)
        new_dri = 100.0 * (0.35 * new_s_norm + 0.40 * m_norm + 0.25 * v_norm)
        new_dri = round(min(max(new_dri, 0.0), 100.0), 2)
        delta_dri = round(new_dri - old_dri, 2)

        results.append({
            "tract_id": tract["tract_id"],
            "name": tract.get("name", ""),
            "city": tract.get("city", ""),
            "distance_m": round(d, 1),
            "current_dri": old_dri,
            "simulated_dri": new_dri,
            "delta_dri": delta_dri,
            "current_tier": _tier_label(old_dri),
            "simulated_tier": _tier_label(new_dri),
            "tier_change": _tier_label(old_dri) != _tier_label(new_dri),
            "new_s_norm": round(new_s_norm, 4),
            "m_norm": round(m_norm, 4),
            "v_norm": round(v_norm, 4),
        })

    results.sort(key=lambda x: x["delta_dri"], reverse=True)
    return results
