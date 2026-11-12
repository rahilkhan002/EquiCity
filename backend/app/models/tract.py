from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TractGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class Tract(BaseModel):
    tract_id: str
    name: str
    city: str
    state: str
    geometry: TractGeometry  # GeoJSON polygon
    area_sqkm: float
    # Demographic / vulnerability snapshot
    total_population: int
    renter_share: float          # 0–1
    low_income_share: float      # <80% AMI, 0–1
    rent_burdened_share: float   # >30% income on rent, 0–1
    median_income_usd: int
    median_rent_usd: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TractDRI(BaseModel):
    tract_id: str
    name: str
    city: str
    dri_score: float
    risk_tier: str
    data_quality: str
    data_quality_range: Optional[str] = None
    s_norm: float
    m_norm: float
    v_norm: float
    computed_at: datetime = Field(default_factory=datetime.utcnow)
