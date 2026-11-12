from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class MarketEvent(BaseModel):
    tract_id: str
    city: str
    event_type: str         # rent_listing | eviction_filing | property_flip | rent_payment
    event_date: datetime
    # Rent metrics
    asking_rent_usd: Optional[float] = None
    unit_sqm: Optional[float] = None
    # Income data for RIR
    household_income_usd: Optional[float] = None
    # Property flip
    purchase_price_usd: Optional[float] = None
    sale_price_usd: Optional[float] = None
    hold_days: Optional[int] = None   # <730 days = speculative flip
    # Eviction
    eviction_count: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
