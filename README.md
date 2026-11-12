# 🌿 EquiCity — Eco-Gentrification & Urban Displacement Early Warning System

> **A Multi-Modal Spatial-Temporal Decision-Support Platform** that forecasts, quantifies, and prevents climate gentrification in vulnerable urban communities.
>
> *Aligned with UN SDGs 10, 11 & 13 · Lead Developer: Rahil Khan · Stack: MongoDB 7.0+, FastAPI, Next.js 14, Mapbox GL JS*

---

## 🗺️ What is EquiCity?

As cities invest billions in green infrastructure (flood walls, urban parks, sponge parks, cooling forests), they inadvertently trigger **eco-gentrification** — a predictable four-stage cycle where speculators price out low-income renters *before construction even finishes*.

EquiCity bridges this gap with a real-time, pre-construction early warning system that:

- **Computes a Displacement Risk Index (DRI)** per census tract, combining spatial green exposure, market speculation velocity, and socio-economic vulnerability
- **Flags informal/data-sparse neighborhoods honestly** using a 3-state data quality policy (never substitutes zero for missing data)
- **Runs Mode A What-If simulations** — urban planners draw a proposed project and immediately see which tracts will cross critical displacement thresholds
- **Emits ACID-transactional NGO alerts** with verbatim zoning PDF citations when DRI ≥ 75

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 Frontend                      │
│   Dashboard (Mapbox choropleth) │ Simulator │ Alert Manager │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / REST
┌─────────────────────▼───────────────────────────────────────┐
│                   FastAPI Backend (Python 3.11)             │
│  DRI Engine │ Uncertainty Service │ Simulator │ Alert Outbox │
└─────────────────────┬───────────────────────────────────────┘
                      │ Motor (async)
┌─────────────────────▼───────────────────────────────────────┐
│          MongoDB 7.0+ Replica Set                           │
│  2dsphere Spatial · Time-Series Windows · ACID Transactions │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 Core Algorithm: Displacement Risk Index (DRI)

$$\text{DRI}(i, t) = 100 \times \left[ 0.35 \cdot S_{\text{norm}} + 0.40 \cdot M_{\text{norm}} + 0.25 \cdot V_{\text{norm}} \right]$$

| Pillar | Weight | Formula |
|---|---|---|
| **S** — Spatial Green Exposure | 35% | `Σ ψ · ln(1 + B/1M) · exp(-0.0012 · d)` over projects within 2km |
| **M** — Market Speculation Velocity | 40% | Sigmoid-Z composite of 180-day rent growth (45%), RIR+PIR burden (30%), eviction+flip turnover (25%) |
| **V** — Socio-Economic Vulnerability | 25% | Weighted: low-income share (40%) + renter share (35%) + rent-burdened share (25%) |

### Risk Tiers
| DRI Score | Tier | Colour |
|---|---|---|
| 0 – 24 | 🟢 LOW | Green |
| 25 – 49 | 🟡 MODERATE | Yellow |
| 50 – 74 | 🟠 HIGH | Orange |
| 75 – 100 | 🔴 CRITICAL | Red |

### Lifecycle Multipliers (ψ)
| Stage | ψ |
|---|---|
| Proposed | 0.50 |
| Approved | 0.85 |
| Under Construction | 1.00 |
| Completed | 0.90 |

### Data Quality States
| State | Meaning |
|---|---|
| `VERIFIED` | ≥12 observations over ≥150 days, fresh (<30 days) |
| `PROVISIONAL_PARTIAL` | Partial data — IQR interval [Q₀.₂₅, Q₀.₇₅] reported |
| `PROVISIONAL_UNOBSERVED` | Zero formal records — conservative bounds [0,1] applied |

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended), OR
- Python 3.11+, Node.js 20+, MongoDB 7.0 running as a replica set

### Option A — Docker Compose (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/rahilkhan002/EquiCity.git
cd EquiCity

# 2. Copy env file and set your Mapbox token
cp .env.example .env
# Edit .env → set MAPBOX_TOKEN=pk.your_actual_token

# 3. Launch everything (MongoDB RS + Backend + Seeder + Frontend)
docker-compose up --build
```

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:8000 |
| **API Docs** | http://localhost:8000/docs |

> The `seeder` service runs automatically once the backend is healthy, populating 20 NYC census tracts, 5 green infrastructure projects, and 200 synthetic market events.

---

### Option B — Local Development (No Docker)

#### 1. MongoDB Replica Set

```bash
# Start a single-node replica set
mongod --replSet rs0 --port 27017 --dbpath /data/db

# In another terminal, initialize it once:
mongosh --eval "rs.initiate()"
```

#### 2. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Seed the database
python -m app.seed.seed_projects
python -m app.seed.seed_tracts

# Run the API
uvicorn app.main:app --reload --port 8000
```

#### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp ../.env.example .env.local
# Edit .env.local → NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token

# Start dev server
npm run dev
```

---

## 📡 API Reference

### Tracts
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tracts?city=New York` | List all tracts |
| `GET` | `/tracts/{tract_id}` | Get single tract |
| `GET` | `/tracts/{tract_id}/dri` | Compute DRI for one tract |
| `GET` | `/tracts/city/{city}/dri-all` | Compute DRI for all tracts in a city |

### Green Projects
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/projects?city=New York` | List green projects |
| `POST` | `/projects` | Add a new project |
| `PATCH` | `/projects/{id}/lifecycle?lifecycle_stage=Approved` | Update lifecycle stage |

### Simulation (Mode A)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/simulate/what-if` | Ceteris paribus what-if simulation |

```json
// POST /simulate/what-if
{
  "city": "New York",
  "geometry": { "type": "Polygon", "coordinates": [[...]] },
  "capital_budget_usd": 85000000,
  "lifecycle_stage": "Proposed",
  "project_type": "Urban Park"
}
```

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/alerts?status=PENDING` | List alerts |
| `POST` | `/alerts/{id}/approve?planner_name=Jane&notes=...` | Approve alert |
| `POST` | `/alerts/{id}/dismiss` | Dismiss alert |

### Ingest
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest/market-events` | Ingest market events → triggers DRI recompute + alert check |

---

## 🗂️ Project Structure

```
EquiCity/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app
│   │   ├── config.py                # Settings
│   │   ├── database.py              # MongoDB Motor client & indexes
│   │   ├── models/                  # Pydantic schemas
│   │   ├── services/
│   │   │   ├── dri_engine.py        # DRI formula (Pillars S+M+V)
│   │   │   ├── spatial_service.py   # GeoPandas/Shapely/PyProj ops
│   │   │   ├── uncertainty.py       # 3-state data quality policy
│   │   │   ├── simulator.py         # Mode A what-if simulation
│   │   │   └── alert_service.py     # ACID transactional outbox
│   │   ├── routers/                 # FastAPI route handlers
│   │   └── seed/                    # Synthetic NYC seed data
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Dashboard (map + risk table)
│   │   │   ├── simulate/page.tsx    # Mode A simulator
│   │   │   └── alerts/page.tsx      # Alert management
│   │   ├── components/
│   │   │   ├── RiskTable.tsx
│   │   │   ├── AlertCard.tsx
│   │   │   └── RiskBadge.tsx
│   │   └── lib/
│   │       ├── api.ts               # Typed API client
│   │       └── types.ts             # Shared TypeScript types
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🌍 Real-World Case Studies

| City & Project | Observed Displacement | EquiCity Intervention |
|---|---|---|
| **NYC — High Line** | Property values +103% within 500m (2003–2011) | Flags Lower East Side tracts at psi=0.85, simulates inclusionary zoning |
| **Ahmedabad — Sabarmati Riverfront** | Thousands of informal riparian households displaced | Conservative bounds [0,1] ensure informal tracts aren't labeled Low Risk |
| **Atlanta — BeltLine** | Home sales +179–266% within 800m over decade | Detects high PIR + flip rates 18 months before trail completion |
| **Barcelona — Superilles** | Investor buyouts in Poblenou & Sant Antoni | 180-day rent velocity windows trigger rent-stabilization overlays |

---

## 🎯 UN SDG Alignment

| SDG Target | EquiCity Role |
|---|---|
| **SDG 11.3** — Civil society in urban planning | Equips tenant unions with auditable DRI projections & zoning citations |
| **SDG 11.7** — Universal green access | Ensures new green spaces stay economically accessible |
| **SDG 10.2** — Reduced inequalities | Monitors <80% AMI tracts, tracks 90-day RIR |
| **SDG 13.1** — Climate action | Integrates anti-displacement safeguards into physical climate risk reduction |

---

## 🔐 ACID Alerting & Policy Citations

When a tract's DRI crosses **≥ 75.0**, EquiCity:

1. Writes the DRI score update + alert payload in a **single multi-document MongoDB replica-set transaction** (WriteConcern majority)
2. Enforces **hysteresis** — activates at 75.0, only resets below 70.0
3. Applies a **14-day cooldown** to prevent alert fatigue
4. Deduplicates via **partial unique index** on `{tract_id, status: "PENDING"}`
5. Requires **mandatory human planner sign-off** before the alert is resolved
6. Attaches **verbatim zoning PDF citations** (document title, publication date, page, clause, exact quote)

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Database** | MongoDB 7.0+ — Replica Set, 2dsphere, Time-Series, ACID |
| **Backend** | Python 3.11, FastAPI, Motor (async), Pydantic v2 |
| **Spatial** | GeoPandas, Shapely, PyProj (UTM projection) |
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS |
| **Maps** | Mapbox GL JS, @mapbox/mapbox-gl-draw |
| **Containers** | Docker, Docker Compose |

---

## 📄 License

MIT License — open source, open data, open equity.

---

*Built with ❤️ for housing justice. If green cities are for everyone, so must be the data that protects everyone.*

