from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

LIFECYCLE_MULTIPLIERS = {
    "Proposed": 0.50,
    "Approved": 0.85,
    "Under Construction": 1.00,
    "Completed": 0.90,
}

class ProjectGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class GreenProject(BaseModel):
    project_id: str
    name: str
    city: str
    project_type: str  # e.g., "Flood Wall", "Urban Park", "Sponge Park"
    lifecycle_stage: str  # Proposed | Approved | Under Construction | Completed
    capital_budget_usd: float
    geometry: ProjectGeometry  # GeoJSON polygon
    description: Optional[str] = None
    announced_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GreenProjectCreate(BaseModel):
    name: str
    city: str
    project_type: str
    lifecycle_stage: str = "Proposed"
    capital_budget_usd: float
    geometry: ProjectGeometry
    description: Optional[str] = None
    announced_date: Optional[datetime] = None
