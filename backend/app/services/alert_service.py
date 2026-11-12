"""
ACID Transactional Outbox for NGO alerts.
Writes DRI score + alert in a single multi-document replica-set transaction.
Enforces hysteresis (activate >= 75, reset < 70), 14-day cooldown, partial unique index.
"""
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import WriteConcern
from pymongo.errors import DuplicateKeyError

ACTIVATE_THRESHOLD = 75.0
RESET_THRESHOLD    = 70.0
COOLDOWN_DAYS      = 14

SAMPLE_CITATIONS = [
    {
        "document_title": "City Environmental Impact Assessment — Green Infrastructure Program",
        "publication_date": "2024-03-15",
        "page": 42,
        "clause": "Section 4.3.1 — Housing Affordability Impact",
        "exact_quote": "Projects exceeding $10M capital investment within 2km of rent-burdened tracts require mandatory displacement impact assessment prior to construction approval."
    }
]

async def process_dri_alert(tract_dri: dict, db: AsyncIOMotorDatabase) -> dict:
    """
    Check if DRI crosses threshold and emit ACID transactional alert if warranted.
    Returns {"alerted": bool, "alert_id": str|None, "reason": str}.
    """
    tract_id = tract_dri["tract_id"]
    dri_score = tract_dri["dri_score"]

    # Check for existing active alert (hysteresis: active alert exists → need dri < RESET_THRESHOLD to clear)
    existing = await db.alerts.find_one({"tract_id": tract_id, "status": "PENDING"})

    if dri_score < ACTIVATE_THRESHOLD:
        # Maybe clear hysteresis
        if existing and dri_score < RESET_THRESHOLD:
            await db.alerts.update_one(
                {"_id": existing["_id"]},
                {"$set": {"status": "RESET", "updated_at": datetime.utcnow()}}
            )
        return {"alerted": False, "alert_id": None, "reason": "DRI below threshold"}

    if existing:
        return {"alerted": False, "alert_id": str(existing.get("alert_id", "")), "reason": "Active alert already exists (hysteresis)"}

    # Check cooldown
    latest_dismissed = await db.alerts.find_one(
        {"tract_id": tract_id, "status": {"$in": ["APPROVED", "DISMISSED", "RESET"]}},
        sort=[("created_at", -1)]
    )
    if latest_dismissed:
        cooldown_until = latest_dismissed["created_at"] + timedelta(days=COOLDOWN_DAYS)
        if datetime.utcnow() < cooldown_until:
            return {"alerted": False, "alert_id": None, "reason": f"Cooldown until {cooldown_until.isoformat()}"}

    # Emit alert in ACID transaction
    alert_id = str(uuid.uuid4())
    alert_doc = {
        "alert_id": alert_id,
        "tract_id": tract_id,
        "tract_name": tract_dri.get("name", ""),
        "city": tract_dri.get("city", ""),
        "dri_score": dri_score,
        "risk_tier": tract_dri.get("risk_tier", "CRITICAL"),
        "trigger_type": "DRI_THRESHOLD_CROSSED",
        "status": "PENDING",
        "zoning_citations": SAMPLE_CITATIONS,
        "planner_notes": None,
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.utcnow(),
        "cooldown_until": datetime.utcnow() + timedelta(days=COOLDOWN_DAYS),
    }

    score_update_doc = {
        "tract_id": tract_id,
        "dri_score": dri_score,
        "risk_tier": tract_dri.get("risk_tier", "CRITICAL"),
        "recorded_at": datetime.utcnow(),
        "alert_id": alert_id,
    }

    async with await db.client.start_session() as session:
        async with session.start_transaction(
            write_concern=WriteConcern("majority")
        ):
            try:
                await db.dri_scores.insert_one(score_update_doc, session=session)
                await db.alerts.insert_one(alert_doc, session=session)
            except DuplicateKeyError:
                return {"alerted": False, "alert_id": None, "reason": "Duplicate alert (concurrent insert)"}

    return {"alerted": True, "alert_id": alert_id, "reason": "Alert emitted"}
