from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import connect_db, close_db
from .routers import tracts, projects, simulate, alerts, ingest

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(
    title="EquiCity API",
    description="Eco-Gentrification & Urban Displacement Early Warning System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tracts.router)
app.include_router(projects.router)
app.include_router(simulate.router)
app.include_router(alerts.router)
app.include_router(ingest.router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "EquiCity API"}
