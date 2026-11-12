from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ZoningCitation(BaseModel):
    document_title: str
    publication_date: str
    page: int
    clause: str
    exact_quote: str

class Alert(BaseModel):
    alert_id: str
    tract_id: str
    tract_name: str
    city: str
    dri_score: float
    risk_tier: str
    trigger_type: str = "DRI_THRESHOLD_CROSSED"
    status: str = "PENDING"   # PENDING | APPROVED | DISMISSED
    zoning_citations: List[ZoningCitation] = []
    planner_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    cooldown_until: Optional[datetime] = None
