from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from ..database import get_db
from ..services.dri_engine import compute_dri, _default_city_stats

router = APIRouter(prefix="/tracts", tags=["Tracts"])

def city_filter(city: str) -> dict:
    clean = city.strip()
    return {"$in": [clean, f"{clean} City", clean.replace(" City", "")]}

@router.get("/")
async def list_tracts(city: Optional[str] = None, db=Depends(get_db)):
    query = {}
    if city:
        query["city"] = city_filter(city)
    tracts = await db.tracts.find(query, {"_id": 0}).to_list(length=500)
    return tracts

@router.get("/{tract_id}")
async def get_tract(tract_id: str, db=Depends(get_db)):
    tract = await db.tracts.find_one({"tract_id": tract_id}, {"_id": 0})
    if not tract:
        raise HTTPException(404, "Tract not found")
    return tract

@router.get("/{tract_id}/dri")
async def get_tract_dri(tract_id: str, db=Depends(get_db)):
    tract = await db.tracts.find_one({"tract_id": tract_id})
    if not tract:
        raise HTTPException(404, "Tract not found")
    result = await compute_dri(tract, db)
    return result

@router.get("/city/{city}/dri-all")
async def get_city_dri(city: str, db=Depends(get_db)):
    """Compute DRI for all tracts in a city with city-wide normalization."""
    tracts = await db.tracts.find({"city": city_filter(city)}).to_list(length=500)
    if not tracts:
        raise HTTPException(404, "No tracts found for this city")

    projects = await db.green_projects.find({"city": city_filter(city)}).to_list(length=500)

    # First pass: compute raw S for normalization
    from ..services.dri_engine import compute_s_raw
    s_raws = []
    for t in tracts:
        s_raws.append(compute_s_raw(t["geometry"], projects))
    city_s_max = max(s_raws) if s_raws else 1.0

    city_stats = _default_city_stats()
    results = []
    for i, tract in enumerate(tracts):
        # Pass pre-computed s_raw via monkey-patch approach
        tract["_s_raw_precomputed"] = s_raws[i]
        dri = await compute_dri(tract, db, city_stats=city_stats, city_s_max=city_s_max)
        results.append(dri)

    results.sort(key=lambda x: x["dri_score"], reverse=True)
    return results
