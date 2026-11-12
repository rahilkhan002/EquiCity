from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from ..database import get_db

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("/")
async def list_alerts(
    status: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = Query(50, le=200),
    db=Depends(get_db)
):
    query = {}
    if status:
        query["status"] = status
    if city:
        query["city"] = city
    alerts = await db.alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    return alerts

@router.get("/{alert_id}")
async def get_alert(alert_id: str, db=Depends(get_db)):
    alert = await db.alerts.find_one({"alert_id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(404, "Alert not found")
    return alert

@router.post("/{alert_id}/approve")
async def approve_alert(alert_id: str, planner_name: str, notes: Optional[str] = None, db=Depends(get_db)):
    result = await db.alerts.update_one(
        {"alert_id": alert_id, "status": "PENDING"},
        {"$set": {
            "status": "APPROVED",
            "approved_by": planner_name,
            "approved_at": datetime.utcnow(),
            "planner_notes": notes,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Alert not found or not in PENDING state")
    return {"alert_id": alert_id, "status": "APPROVED"}

@router.post("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, db=Depends(get_db)):
    result = await db.alerts.update_one(
        {"alert_id": alert_id, "status": "PENDING"},
        {"$set": {"status": "DISMISSED", "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Alert not found or not in PENDING state")
    return {"alert_id": alert_id, "status": "DISMISSED"}
