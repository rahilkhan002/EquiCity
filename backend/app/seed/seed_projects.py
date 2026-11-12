"""
Seed script: 5 NYC green infrastructure projects.
Run from backend/ directory:
    python -m app.seed.seed_projects
"""
import asyncio
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017/?replicaSet=rs0"
DB_NAME = "equicity"


def make_polygon(lon: float, lat: float, half: float = 0.004):
    """Create a small square GeoJSON polygon."""
    coords = [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
    ]
    return {"type": "Polygon", "coordinates": [coords]}


PROJECTS = [
    {
        "project_id": str(uuid.uuid4()),
        "name": "High Line Extension",
        "city": "New York",
        "project_type": "Urban Park",
        "lifecycle_stage": "Under Construction",
        "capital_budget_usd": 85_000_000.0,
        "geometry": make_polygon(-74.0048, 40.7484),   # Chelsea / Hudson Yards area
        "description": (
            "Northward extension of the High Line elevated greenway from 34th Street "
            "into Hudson Yards, adding 1.4 km of linear park with native plantings, "
            "seating, and stormwater bioswales. Expected to serve 8M+ annual visitors."
        ),
        "announced_date": datetime(2022, 6, 14),
        "created_at": datetime.utcnow(),
    },
    {
        "project_id": str(uuid.uuid4()),
        "name": "East Side Coastal Resiliency",
        "city": "New York",
        "project_type": "Flood Wall",
        "lifecycle_stage": "Approved",
        "capital_budget_usd": 1_450_000_000.0,
        "geometry": make_polygon(-73.9755, 40.7120, half=0.006),  # Lower East Side waterfront
        "description": (
            "2.4-mile flood-protection system along the East River from Montgomery Street "
            "to 25th Street, featuring deployable flood barriers, raised esplanades, "
            "restored wetlands, and resilient park spaces. Designed to protect against "
            "100-year storm surges exacerbated by sea-level rise."
        ),
        "announced_date": datetime(2021, 4, 22),
        "created_at": datetime.utcnow(),
    },
    {
        "project_id": str(uuid.uuid4()),
        "name": "South Bronx Greenway",
        "city": "New York",
        "project_type": "Sponge Park",
        "lifecycle_stage": "Proposed",
        "capital_budget_usd": 45_000_000.0,
        "geometry": make_polygon(-73.9237, 40.8044, half=0.005),  # Mott Haven / South Bronx
        "description": (
            "5-block sponge-park greenway along the Harlem River waterfront in the South Bronx, "
            "incorporating permeable pavement, bioretention cells, and urban tree canopy "
            "to reduce combined sewer overflows and provide waterfront access to EJ communities. "
            "Planned with community land trust partnerships to prevent displacement."
        ),
        "announced_date": datetime(2023, 9, 5),
        "created_at": datetime.utcnow(),
    },
    {
        "project_id": str(uuid.uuid4()),
        "name": "Brooklyn Waterfront Greenway",
        "city": "New York",
        "project_type": "Urban Park",
        "lifecycle_stage": "Under Construction",
        "capital_budget_usd": 120_000_000.0,
        "geometry": make_polygon(-73.9566, 40.7101, half=0.005),  # Williamsburg waterfront
        "description": (
            "Contiguous 26-mile waterfront greenway linking Greenpoint, Williamsburg, "
            "DUMBO, Red Hook, and Bay Ridge with protected bike lanes, esplanade promenades, "
            "and activated public plazas. Phase 2 (Williamsburg segment) currently under "
            "construction; completion expected Q3 2026."
        ),
        "announced_date": datetime(2020, 11, 18),
        "created_at": datetime.utcnow(),
    },
    {
        "project_id": str(uuid.uuid4()),
        "name": "Queens Boulevard Greenway",
        "city": "New York",
        "project_type": "Urban Park",
        "lifecycle_stage": "Approved",
        "capital_budget_usd": 60_000_000.0,
        "geometry": make_polygon(-73.8330, 40.7675, half=0.005),  # Flushing / Queens Blvd corridor
        "description": (
            "Transformation of the central medians of Queens Boulevard from Union Turnpike "
            "to Main Street into a linear greenway featuring dedicated cycling infrastructure, "
            "tree-lined pedestrian paths, pocket plazas, and shade structures. Addresses the "
            "\"Boulevard of Death\" safety record while adding 3.1 miles of new green space "
            "in a dense, transit-rich corridor."
        ),
        "announced_date": datetime(2023, 3, 1),
        "created_at": datetime.utcnow(),
    },
]


async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print("Dropping existing green_projects…")
    await db.green_projects.drop()

    print(f"Inserting {len(PROJECTS)} green projects…")
    await db.green_projects.insert_many(PROJECTS)

    # Create indexes
    from pymongo import GEOSPHERE, ASCENDING
    await db.green_projects.create_index([("geometry", GEOSPHERE)])
    await db.green_projects.create_index([("project_id", ASCENDING)], unique=True)
    await db.green_projects.create_index([("city", ASCENDING), ("lifecycle_stage", ASCENDING)])

    print("\n✅ Projects seeded successfully!\n")
    total_budget = sum(p["capital_budget_usd"] for p in PROJECTS)
    print(f"{'Project':<35} {'Stage':<22} {'Budget':>16}")
    print("-" * 76)
    for p in PROJECTS:
        budget_fmt = f"${p['capital_budget_usd']:,.0f}"
        print(f"{p['name']:<35} {p['lifecycle_stage']:<22} {budget_fmt:>16}")
    print("-" * 76)
    print(f"{'TOTAL':<58} ${total_budget:>14,.0f}")
    print()

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
