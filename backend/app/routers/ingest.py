from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime
from ..database import get_db
from ..models.market_event import MarketEvent
from ..services.alert_service import process_dri_alert
from ..services.dri_engine import compute_dri, compute_s_raw, _default_city_stats

router = APIRouter(prefix="/ingest", tags=["Ingest"])

@router.post("/market-events")
async def ingest_market_events(events: List[MarketEvent], db=Depends(get_db)):
    """Ingest market events and trigger DRI recomputation + alert check."""
    docs = [e.model_dump() for e in events]
    for d in docs:
        if isinstance(d.get("event_date"), datetime):
            pass
        else:
            d["event_date"] = datetime.utcnow()
    if docs:
        await db.market_events.insert_many(docs)

    # Recompute DRI for affected tracts
    tract_ids = list(set(e.tract_id for e in events))
    alert_results = []
    for tid in tract_ids:
        tract = await db.tracts.find_one({"tract_id": tid})
        if not tract:
            continue
        projects = await db.green_projects.find({"city": tract["city"]}).to_list(length=500)
        s_raws_all = []
        city_tracts = await db.tracts.find({"city": tract["city"]}).to_list(length=500)
        for ct in city_tracts:
            s_raws_all.append(compute_s_raw(ct["geometry"], projects))
        city_s_max = max(s_raws_all) if s_raws_all else 1.0

        dri = await compute_dri(tract, db, city_stats=_default_city_stats(), city_s_max=city_s_max)
        alert_res = await process_dri_alert(dri, db)
        alert_results.append({"tract_id": tid, "dri": dri["dri_score"], "alert": alert_res})

    return {"ingested": len(docs), "tract_updates": alert_results}
