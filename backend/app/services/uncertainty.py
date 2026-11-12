"""
Three-State Data Quality & Uncertainty Policy:
  VERIFIED                   – full observations
  PROVISIONAL_PARTIAL        – partial observations, IQR bounds reported
  PROVISIONAL_UNOBSERVED     – zero formal records
"""
from typing import Tuple, Optional

MIN_OBSERVATIONS = 12
MIN_SPAN_DAYS = 150
FRESHNESS_DAYS = 30

def classify_data_quality(
    obs_count: int,
    span_days: float,
    days_since_latest: float
) -> str:
    if (obs_count >= MIN_OBSERVATIONS
            and span_days >= MIN_SPAN_DAYS
            and days_since_latest <= FRESHNESS_DAYS):
        return "VERIFIED"
    if obs_count == 0:
        return "PROVISIONAL_UNOBSERVED"
    return "PROVISIONAL_PARTIAL"

def build_uncertainty_label(
    data_quality: str,
    dri_low: float,
    dri_high: float,
    critical_threshold: float = 75.0
) -> str:
    if data_quality == "VERIFIED":
        return _tier_label(dri_low)

    def tier(v):
        if v < 25: return "LOW"
        if v < 50: return "MODERATE"
        if v < 75: return "HIGH"
        return "CRITICAL"

    low_tier = tier(dri_low)
    high_tier = tier(dri_high)
    base = f"PROVISIONAL_SPANNING_{low_tier}_TO_{high_tier}"
    if data_quality == "PROVISIONAL_UNOBSERVED":
        base = "UNOBSERVED_CONSERVATIVE_" + f"SPANNING_{low_tier}_TO_{high_tier}"
    if dri_high >= critical_threshold:
        base += "_CONSERVATIVE_CRITICAL_TAIL"
    return base

def _tier_label(score: float) -> str:
    if score < 25: return "LOW"
    if score < 50: return "MODERATE"
    if score < 75: return "HIGH"
    return "CRITICAL"
