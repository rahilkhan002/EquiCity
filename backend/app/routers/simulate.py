from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from ..database import get_db
from ..services.simulator import simulate_project_impact
from ..services.spatial_service import buffer_polygon_meters, polygon_intersects
from ..services.dri_engine import compute_dri, compute_s_raw, _default_city_stats

router = APIRouter(prefix="/simulate", tags=["Simulation"])

class SimulateRequest(BaseModel):
    city: str
    geometry: dict           # GeoJSON Polygon of proposed project
    capital_budget_usd: float
    lifecycle_stage: str = "Proposed"
    project_type: str = "Urban Park"

def city_filter(city: str) -> dict:
    clean = city.strip()
    return {"$in": [clean, f"{clean} City", clean.replace(" City", "")]}

@router.post("/what-if")
async def simulate_what_if(req: SimulateRequest, db=Depends(get_db)):
    """
    Mode A: Ceteris Paribus What-If simulation.
    Draw a proposed project polygon → get DRI impact on nearby tracts.
    """
    # Buffer by 2000m to find candidate tracts
    buffered = buffer_polygon_meters(req.geometry, 2000)

    # Fetch tracts in city
    tracts = await db.tracts.find({"city": city_filter(req.city)}).to_list(length=500)
    if not tracts:
        raise HTTPException(404, "No tracts found for city")

    projects = await db.green_projects.find({"city": city_filter(req.city)}).to_list(length=500)
    s_raws = [compute_s_raw(t["geometry"], projects) for t in tracts]
    city_s_max = max(s_raws) if s_raws else 1.0

    city_stats = _default_city_stats()

    # Compute current DRI for affected tracts
    affected = []
    for i, tract in enumerate(tracts):
        if polygon_intersects(tract["geometry"], buffered):
            dri = await compute_dri(tract, db, city_stats=city_stats, city_s_max=city_s_max)
            dri["geometry"] = tract["geometry"]
            affected.append(dri)

    if not affected:
        return {"message": "No tracts within 2km of proposed project", "impacts": []}

    impacts = simulate_project_impact(
        proposed_geometry=req.geometry,
        capital_budget_usd=req.capital_budget_usd,
        lifecycle_stage=req.lifecycle_stage,
        affected_tracts=affected,
    )

    return {
        "city": req.city,
        "project_type": req.project_type,
        "lifecycle_stage": req.lifecycle_stage,
        "capital_budget_usd": req.capital_budget_usd,
        "affected_tract_count": len(impacts),
        "impacts": impacts,
        "model_assumptions": "M_norm and V_norm held constant (ceteris paribus). Only S_norm updated with proposed project exposure.",
    }
