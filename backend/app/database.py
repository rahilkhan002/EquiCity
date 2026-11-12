import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import GEOSPHERE, ASCENDING, DESCENDING
from .config import settings

client: AsyncIOMotorClient = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]
    await create_indexes()

async def close_db():
    if client:
        client.close()

async def create_indexes():
    # Tracts: 2dsphere on geometry
    await db.tracts.create_index([("geometry", GEOSPHERE)])
    await db.tracts.create_index([("tract_id", ASCENDING)], unique=True)
    await db.tracts.create_index([("city", ASCENDING)])

    # Green projects: 2dsphere on geometry
    await db.green_projects.create_index([("geometry", GEOSPHERE)])
    await db.green_projects.create_index([("project_id", ASCENDING)], unique=True)
    await db.green_projects.create_index([("city", ASCENDING), ("lifecycle_stage", ASCENDING)])

    # Market events: time-series style
    await db.market_events.create_index([("tract_id", ASCENDING), ("event_date", DESCENDING)])
    await db.market_events.create_index([("city", ASCENDING), ("event_type", ASCENDING), ("event_date", DESCENDING)])

    # Alerts: partial unique index to prevent duplicate active alerts per tract
    await db.alerts.create_index(
        [("tract_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"status": "PENDING"}
    )
    await db.alerts.create_index([("status", ASCENDING), ("created_at", DESCENDING)])

def get_db():
    return db
