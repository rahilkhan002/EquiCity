"""
Seed script: 20 synthetic NYC census tracts + 200 market events.
Run from backend/ directory:
    python -m app.seed.seed_tracts
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017/?replicaSet=rs0"
DB_NAME = "equicity"

# ─── Tract definitions ───────────────────────────────────────────────────────
# Each entry: (name, center_lon, center_lat, renter_share, low_income_share,
#              rent_burdened_share, median_income_usd, median_rent_usd, population)

TRACT_CONFIGS = [
    # name,                   lon,      lat,    rent,  li,   rb,   income,  rent,  pop
    ("Chelsea",             -74.0005, 40.7465, 0.72, 0.38, 0.44,  72000, 3200, 11200),
    ("Lower East Side",     -73.9876, 40.7152, 0.84, 0.61, 0.58,  48000, 2800, 15600),
    ("Harlem",              -73.9465, 40.8116, 0.78, 0.65, 0.62,  41000, 2200, 23400),
    ("Bushwick",            -73.9204, 40.6944, 0.81, 0.67, 0.64,  38000, 2050, 29000),
    ("Crown Heights",       -73.9442, 40.6694, 0.75, 0.59, 0.57,  44000, 2300, 24700),
    ("Astoria",             -73.9304, 40.7721, 0.68, 0.42, 0.45,  61000, 2600, 18900),
    ("Williamsburg",        -73.9566, 40.7081, 0.76, 0.48, 0.52,  58000, 3100, 20300),
    ("Bed-Stuy",            -73.9496, 40.6872, 0.73, 0.60, 0.59,  43000, 2150, 32100),
    ("East Village",        -73.9816, 40.7265, 0.80, 0.44, 0.50,  65000, 3400, 10800),
    ("Hell's Kitchen",      -73.9942, 40.7638, 0.74, 0.40, 0.46,  68000, 3300, 14500),
    ("South Bronx",         -73.9196, 40.8120, 0.86, 0.72, 0.68,  32000, 1800, 38000),
    ("Flushing",            -73.8330, 40.7675, 0.65, 0.49, 0.53,  54000, 2400, 27600),
    ("Sunset Park",         -74.0046, 40.6500, 0.71, 0.55, 0.56,  47000, 2100, 22100),
    ("Jackson Heights",     -73.8831, 40.7557, 0.69, 0.51, 0.54,  52000, 2350, 25800),
    ("Greenpoint",          -73.9513, 40.7299, 0.70, 0.36, 0.41,  74000, 3000, 13200),
    ("Fort Greene",         -73.9752, 40.6896, 0.66, 0.43, 0.47,  67000, 2900, 16400),
    ("East Harlem",         -73.9372, 40.7957, 0.82, 0.70, 0.66,  36000, 1950, 31700),
    ("Mott Haven",          -73.9237, 40.8044, 0.88, 0.74, 0.70,  30000, 1700, 34200),
    ("Kingsbridge",         -73.9025, 40.8688, 0.76, 0.58, 0.55,  46000, 2200, 21300),
    ("Flatbush",            -73.9617, 40.6411, 0.72, 0.56, 0.58,  45000, 2250, 28900),
]

def make_tract_polygon(lon: float, lat: float, half: float = 0.005):
    """Create a small square GeoJSON polygon around (lon, lat)."""
    coords = [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],  # close ring
    ]
    return {"type": "Polygon", "coordinates": [coords]}

def build_tracts():
    tracts = []
    for (name, lon, lat, rent_share, li_share, rb_share,
         med_income, med_rent, pop) in TRACT_CONFIGS:
        clean_name = name.upper().replace(' ', '-').replace("'", "")
        tract_id = f"NYC-{clean_name}"
        geom = make_tract_polygon(lon, lat)
        tracts.append({
            "tract_id": tract_id,
            "name": name,
            "city": "New York",
            "state": "NY",
            "geometry": geom,
            "area_sqkm": round(random.uniform(0.8, 2.5), 2),
            "total_population": pop,
            "renter_share": rent_share,
            "low_income_share": li_share,
            "rent_burdened_share": rb_share,
            "median_income_usd": med_income,
            "median_rent_usd": med_rent,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
    return tracts

# ─── Market event generation ─────────────────────────────────────────────────

def random_date(days_back: int = 365) -> datetime:
    return datetime.utcnow() - timedelta(days=random.randint(0, days_back))

def build_market_events(tracts: list, total: int = 200) -> list:
    events = []
    # Weight tracts by vulnerability to generate more events in higher-risk areas
    weights = [t["low_income_share"] + t["renter_share"] for t in tracts]
    total_w = sum(weights)
    weights = [w / total_w for w in weights]

    event_types = ["rent_listing", "eviction_filing", "property_flip", "rent_payment"]

    for _ in range(total):
        tract = random.choices(tracts, weights=weights, k=1)[0]
        tid = tract["tract_id"]
        city = tract["city"]
        etype = random.choices(
            event_types, weights=[0.45, 0.20, 0.15, 0.20], k=1
        )[0]
        edate = random_date(365)

        base_rent = tract["median_rent_usd"]
        base_income = tract["median_income_usd"]

        doc = {
            "tract_id": tid,
            "city": city,
            "event_type": etype,
            "event_date": edate,
            "created_at": datetime.utcnow(),
        }

        if etype == "rent_listing":
            # Scatter asking rents around median with some uplift
            asking = base_rent * random.uniform(0.85, 1.35)
            sqm = random.uniform(35, 90)
            doc["asking_rent_usd"] = round(asking, 2)
            doc["unit_sqm"] = round(sqm, 1)
            doc["household_income_usd"] = round(base_income * random.uniform(0.7, 1.3))

        elif etype == "rent_payment":
            asking = base_rent * random.uniform(0.80, 1.20)
            doc["asking_rent_usd"] = round(asking, 2)
            doc["unit_sqm"] = round(random.uniform(35, 90), 1)
            doc["household_income_usd"] = round(base_income * random.uniform(0.6, 1.1))

        elif etype == "eviction_filing":
            doc["eviction_count"] = random.randint(1, 8)

        elif etype == "property_flip":
            purchase = base_income * random.uniform(6, 14)
            sale = purchase * random.uniform(1.05, 1.45)
            hold = random.randint(90, 900)
            doc["purchase_price_usd"] = round(purchase, 2)
            doc["sale_price_usd"] = round(sale, 2)
            doc["hold_days"] = hold
            doc["household_income_usd"] = round(base_income * random.uniform(0.7, 1.2))

        events.append(doc)

    return events

# ─── Main ────────────────────────────────────────────────────────────────────

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print("Dropping existing tracts and market events…")
    await db.tracts.drop()
    await db.market_events.drop()

    tracts = build_tracts()
    print(f"Inserting {len(tracts)} tracts…")
    await db.tracts.insert_many(tracts)

    # Create indexes
    from pymongo import GEOSPHERE, ASCENDING, DESCENDING
    await db.tracts.create_index([("geometry", GEOSPHERE)])
    await db.tracts.create_index([("tract_id", ASCENDING)], unique=True)
    await db.tracts.create_index([("city", ASCENDING)])

    events = build_market_events(tracts, total=200)
    print(f"Inserting {len(events)} market events…")
    await db.market_events.insert_many(events)

    await db.market_events.create_index([("tract_id", ASCENDING), ("event_date", DESCENDING)])
    await db.market_events.create_index([("city", ASCENDING), ("event_type", ASCENDING), ("event_date", DESCENDING)])

    # Print summary
    type_counts = {}
    for e in events:
        type_counts[e["event_type"]] = type_counts.get(e["event_type"], 0) + 1

    print("\n✅ Seed complete!")
    print(f"   Tracts inserted       : {len(tracts)}")
    print(f"   Market events inserted: {len(events)}")
    print("   Event breakdown:")
    for k, v in sorted(type_counts.items()):
        print(f"     {k:<22}: {v}")
    print("\nTop 5 highest-vulnerability tracts:")
    ranked = sorted(tracts, key=lambda t: t["low_income_share"] + t["renter_share"], reverse=True)[:5]
    for t in ranked:
        print(f"   {t['name']:<20} li={t['low_income_share']:.2f}  renter={t['renter_share']:.2f}  rb={t['rent_burdened_share']:.2f}")

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
