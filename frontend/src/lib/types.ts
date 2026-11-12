export interface TractDRI {
  tract_id: string
  name: string
  city: string
  dri_score: number
  risk_tier: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  data_quality: 'VERIFIED' | 'PROVISIONAL_PARTIAL' | 'PROVISIONAL_UNOBSERVED'
  uncertainty_label: string
  dri_range?: string
  s_norm: number
  m_norm: number
  v_norm: number
  computed_at: string
}

export interface Tract {
  tract_id: string
  name: string
  city: string
  state: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  area_sqkm: number
  total_population: number
  renter_share: number
  low_income_share: number
  rent_burdened_share: number
  median_income_usd: number
  median_rent_usd: number
}

export interface GreenProject {
  project_id: string
  name: string
  city: string
  project_type: string
  lifecycle_stage: 'Proposed' | 'Approved' | 'Under Construction' | 'Completed'
  capital_budget_usd: number
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  description?: string
}

export interface Alert {
  alert_id: string
  tract_id: string
  tract_name: string
  city: string
  dri_score: number
  risk_tier: string
  trigger_type: string
  status: 'PENDING' | 'APPROVED' | 'DISMISSED'
  zoning_citations: ZoningCitation[]
  planner_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
}

export interface ZoningCitation {
  document_title: string
  publication_date: string
  page: number
  clause: string
  exact_quote: string
}

export interface SimulationImpact {
  tract_id: string
  name: string
  city: string
  distance_m: number
  current_dri: number
  simulated_dri: number
  delta_dri: number
  current_tier: string
  simulated_tier: string
  tier_change: boolean
  new_s_norm: number
  m_norm: number
  v_norm: number
}

export interface SimulationResult {
  city: string
  project_type: string
  lifecycle_stage: string
  capital_budget_usd: number
  affected_tract_count: number
  impacts: SimulationImpact[]
  model_assumptions: string
}
