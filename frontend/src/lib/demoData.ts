import type { TractDRI, Tract, GreenProject, Alert } from './types'

export const OPEN_MAP_STYLE = {
  version: 8,
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    },
    'esri-dark-ref': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#111827',
      },
    },
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 16,
    },
    {
      id: 'esri-dark-ref-layer',
      type: 'raster',
      source: 'esri-dark-ref',
      minzoom: 0,
      maxzoom: 16,
      paint: {
        'raster-opacity': 0.8,
      },
    },
  ],
}

function makeDistrictPolygon(
  centerLon: number,
  centerLat: number,
  radiusLon: number = 0.011,
  radiusLat: number = 0.014,
  angleDeg: number = 29,
  seed: number = 1
) {
  const points: [number, number][] = []
  const steps = 14
  const radAngle = (angleDeg * Math.PI) / 180
  const cosA = Math.cos(radAngle)
  const sinA = Math.sin(radAngle)

  for (let i = 0; i < steps; i++) {
    const angle = (i * 2 * Math.PI) / steps
    const rVar = 0.88 + 0.20 * Math.sin(angle * 2 + seed) + 0.10 * Math.cos(angle * 3 + seed * 1.5)
    const rx = radiusLon * rVar
    const ry = radiusLat * rVar

    const px = rx * Math.cos(angle)
    const py = ry * Math.sin(angle)

    const rotX = px * cosA - py * sinA
    const rotY = px * sinA + py * cosA

    points.push([
      Math.round((centerLon + rotX) * 100000) / 100000,
      Math.round((centerLat + rotY) * 100000) / 100000,
    ])
  }
  points.push(points[0])
  return {
    type: 'Polygon' as const,
    coordinates: [points],
  }
}

function makeCorridor(
  startLon: number,
  startLat: number,
  endLon: number,
  endLat: number,
  widthMeters: number = 320
) {
  const dx = endLon - startLon
  const dy = endLat - startLat
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return makeDistrictPolygon(startLon, startLat, 0.005, 0.005)
  const perpX = (-dy / len) * (widthMeters / 85000)
  const perpY = (dx / len) * (widthMeters / 111000)

  const coords = [
    [startLon + perpX, startLat + perpY],
    [endLon + perpX, endLat + perpY],
    [endLon - perpX, endLat - perpY],
    [startLon - perpX, startLat - perpY],
    [startLon + perpX, startLat + perpY],
  ]
  return {
    type: 'Polygon' as const,
    coordinates: [coords],
  }
}

export const DEMO_TRACTS: Tract[] = [
  { tract_id: 'NYC-CHELSEA', name: 'Chelsea', city: 'New York', state: 'NY', area_sqkm: 1.8, total_population: 11200, renter_share: 0.72, low_income_share: 0.38, rent_burdened_share: 0.44, median_income_usd: 72000, median_rent_usd: 3200, geometry: makeDistrictPolygon(-74.0005, 40.7465, 0.009, 0.015, 29, 2) },
  { tract_id: 'NYC-LOWER-EAST-SIDE', name: 'Lower East Side', city: 'New York', state: 'NY', area_sqkm: 1.5, total_population: 15600, renter_share: 0.84, low_income_share: 0.61, rent_burdened_share: 0.58, median_income_usd: 48000, median_rent_usd: 2800, geometry: makeDistrictPolygon(-73.9876, 40.7152, 0.011, 0.013, 20, 3) },
  { tract_id: 'NYC-HARLEM', name: 'Harlem', city: 'New York', state: 'NY', area_sqkm: 2.1, total_population: 23400, renter_share: 0.78, low_income_share: 0.65, rent_burdened_share: 0.62, median_income_usd: 41000, median_rent_usd: 2200, geometry: makeDistrictPolygon(-73.9465, 40.8116, 0.012, 0.016, 29, 4) },
  { tract_id: 'NYC-BUSHWICK', name: 'Bushwick', city: 'New York', state: 'NY', area_sqkm: 2.4, total_population: 29000, renter_share: 0.81, low_income_share: 0.67, rent_burdened_share: 0.64, median_income_usd: 38000, median_rent_usd: 2050, geometry: makeDistrictPolygon(-73.9204, 40.6944, 0.014, 0.013, -15, 5) },
  { tract_id: 'NYC-CROWN-HEIGHTS', name: 'Crown Heights', city: 'New York', state: 'NY', area_sqkm: 2.2, total_population: 24700, renter_share: 0.75, low_income_share: 0.59, rent_burdened_share: 0.57, median_income_usd: 44000, median_rent_usd: 2300, geometry: makeDistrictPolygon(-73.9442, 40.6694, 0.015, 0.012, 0, 6) },
  { tract_id: 'NYC-ASTORIA', name: 'Astoria', city: 'New York', state: 'NY', area_sqkm: 1.9, total_population: 18900, renter_share: 0.68, low_income_share: 0.42, rent_burdened_share: 0.45, median_income_usd: 61000, median_rent_usd: 2600, geometry: makeDistrictPolygon(-73.9304, 40.7721, 0.013, 0.013, 10, 7) },
  { tract_id: 'NYC-WILLIAMSBURG', name: 'Williamsburg', city: 'New York', state: 'NY', area_sqkm: 1.7, total_population: 20300, renter_share: 0.76, low_income_share: 0.48, rent_burdened_share: 0.52, median_income_usd: 58000, median_rent_usd: 3100, geometry: makeDistrictPolygon(-73.9566, 40.7081, 0.012, 0.014, -20, 8) },
  { tract_id: 'NYC-BED-STUY', name: 'Bed-Stuy', city: 'New York', state: 'NY', area_sqkm: 2.5, total_population: 32100, renter_share: 0.73, low_income_share: 0.60, rent_burdened_share: 0.59, median_income_usd: 43000, median_rent_usd: 2150, geometry: makeDistrictPolygon(-73.9496, 40.6872, 0.015, 0.013, -5, 9) },
  { tract_id: 'NYC-EAST-VILLAGE', name: 'East Village', city: 'New York', state: 'NY', area_sqkm: 1.2, total_population: 10800, renter_share: 0.80, low_income_share: 0.44, rent_burdened_share: 0.50, median_income_usd: 65000, median_rent_usd: 3400, geometry: makeDistrictPolygon(-73.9816, 40.7265, 0.010, 0.013, 29, 10) },
  { tract_id: 'NYC-HELLS-KITCHEN', name: "Hell's Kitchen", city: 'New York', state: 'NY', area_sqkm: 1.6, total_population: 14500, renter_share: 0.74, low_income_share: 0.40, rent_burdened_share: 0.46, median_income_usd: 68000, median_rent_usd: 3300, geometry: makeDistrictPolygon(-73.9942, 40.7638, 0.009, 0.015, 29, 11) },
  { tract_id: 'NYC-SOUTH-BRONX', name: 'South Bronx', city: 'New York', state: 'NY', area_sqkm: 2.8, total_population: 38000, renter_share: 0.86, low_income_share: 0.72, rent_burdened_share: 0.68, median_income_usd: 32000, median_rent_usd: 1800, geometry: makeDistrictPolygon(-73.9196, 40.8120, 0.013, 0.015, 15, 12) },
  { tract_id: 'NYC-FLUSHING', name: 'Flushing', city: 'New York', state: 'NY', area_sqkm: 2.6, total_population: 27600, renter_share: 0.65, low_income_share: 0.49, rent_burdened_share: 0.53, median_income_usd: 54000, median_rent_usd: 2400, geometry: makeDistrictPolygon(-73.8330, 40.7675, 0.015, 0.014, 0, 13) },
  { tract_id: 'NYC-SUNSET-PARK', name: 'Sunset Park', city: 'New York', state: 'NY', area_sqkm: 2.3, total_population: 22100, renter_share: 0.71, low_income_share: 0.55, rent_burdened_share: 0.56, median_income_usd: 47000, median_rent_usd: 2100, geometry: makeDistrictPolygon(-74.0046, 40.6500, 0.011, 0.016, 35, 14) },
  { tract_id: 'NYC-JACKSON-HEIGHTS', name: 'Jackson Heights', city: 'New York', state: 'NY', area_sqkm: 2.1, total_population: 25800, renter_share: 0.69, low_income_share: 0.51, rent_burdened_share: 0.54, median_income_usd: 52000, median_rent_usd: 2350, geometry: makeDistrictPolygon(-73.8831, 40.7557, 0.014, 0.012, 10, 15) },
  { tract_id: 'NYC-GREENPOINT', name: 'Greenpoint', city: 'New York', state: 'NY', area_sqkm: 1.6, total_population: 13200, renter_share: 0.70, low_income_share: 0.36, rent_burdened_share: 0.41, median_income_usd: 74000, median_rent_usd: 3000, geometry: makeDistrictPolygon(-73.9513, 40.7299, 0.011, 0.013, 10, 16) },
  { tract_id: 'NYC-FORT-GREENE', name: 'Fort Greene', city: 'New York', state: 'NY', area_sqkm: 1.5, total_population: 16400, renter_share: 0.66, low_income_share: 0.43, rent_burdened_share: 0.47, median_income_usd: 67000, median_rent_usd: 2900, geometry: makeDistrictPolygon(-73.9752, 40.6896, 0.011, 0.012, 0, 17) },
  { tract_id: 'NYC-EAST-HARLEM', name: 'East Harlem', city: 'New York', state: 'NY', area_sqkm: 2.4, total_population: 31700, renter_share: 0.82, low_income_share: 0.70, rent_burdened_share: 0.66, median_income_usd: 36000, median_rent_usd: 1950, geometry: makeDistrictPolygon(-73.9372, 40.7957, 0.010, 0.016, 29, 18) },
  { tract_id: 'NYC-MOTT-HAVEN', name: 'Mott Haven', city: 'New York', state: 'NY', area_sqkm: 2.5, total_population: 34200, renter_share: 0.88, low_income_share: 0.74, rent_burdened_share: 0.70, median_income_usd: 30000, median_rent_usd: 1700, geometry: makeDistrictPolygon(-73.9237, 40.8044, 0.012, 0.013, 20, 19) },
  { tract_id: 'NYC-KINGSBRIDGE', name: 'Kingsbridge', city: 'New York', state: 'NY', area_sqkm: 2.0, total_population: 21300, renter_share: 0.76, low_income_share: 0.58, rent_burdened_share: 0.55, median_income_usd: 46000, median_rent_usd: 2200, geometry: makeDistrictPolygon(-73.9025, 40.8688, 0.012, 0.015, 30, 20) },
  { tract_id: 'NYC-FLATBUSH', name: 'Flatbush', city: 'New York', state: 'NY', area_sqkm: 2.3, total_population: 28900, renter_share: 0.72, low_income_share: 0.56, rent_burdened_share: 0.58, median_income_usd: 45000, median_rent_usd: 2250, geometry: makeDistrictPolygon(-73.9617, 40.6411, 0.014, 0.014, 0, 21) },
]

export const DEMO_DRI: TractDRI[] = [
  { tract_id: 'NYC-MOTT-HAVEN', name: 'Mott Haven', city: 'New York', dri_score: 83.4, risk_tier: 'CRITICAL', data_quality: 'VERIFIED', uncertainty_label: 'CRITICAL', s_norm: 0.88, m_norm: 0.82, v_norm: 0.81, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-SOUTH-BRONX', name: 'South Bronx', city: 'New York', dri_score: 79.8, risk_tier: 'CRITICAL', data_quality: 'VERIFIED', uncertainty_label: 'CRITICAL', s_norm: 0.82, m_norm: 0.78, v_norm: 0.80, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-LOWER-EAST-SIDE', name: 'Lower East Side', city: 'New York', dri_score: 76.5, risk_tier: 'CRITICAL', data_quality: 'VERIFIED', uncertainty_label: 'CRITICAL', s_norm: 0.85, m_norm: 0.75, v_norm: 0.67, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-EAST-HARLEM', name: 'East Harlem', city: 'New York', dri_score: 73.2, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.69, m_norm: 0.76, v_norm: 0.75, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-BUSHWICK', name: 'Bushwick', city: 'New York', dri_score: 71.9, risk_tier: 'HIGH', data_quality: 'PROVISIONAL_PARTIAL', uncertainty_label: 'PROVISIONAL_SPANNING_MODERATE_TO_CRITICAL', dri_range: '48.2–78.6', s_norm: 0.65, m_norm: 0.74, v_norm: 0.73, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-WILLIAMSBURG', name: 'Williamsburg', city: 'New York', dri_score: 68.4, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.84, m_norm: 0.66, v_norm: 0.55, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-CHELSEA', name: 'Chelsea', city: 'New York', dri_score: 66.8, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.92, m_norm: 0.61, v_norm: 0.44, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-HARLEM', name: 'Harlem', city: 'New York', dri_score: 64.7, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.54, m_norm: 0.71, v_norm: 0.69, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-BED-STUY', name: 'Bed-Stuy', city: 'New York', dri_score: 61.3, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.52, m_norm: 0.67, v_norm: 0.65, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-EAST-VILLAGE', name: 'East Village', city: 'New York', dri_score: 58.1, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.68, m_norm: 0.59, v_norm: 0.51, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-CROWN-HEIGHTS', name: 'Crown Heights', city: 'New York', dri_score: 54.6, risk_tier: 'HIGH', data_quality: 'PROVISIONAL_PARTIAL', uncertainty_label: 'PROVISIONAL_SPANNING_MODERATE_TO_HIGH', dri_range: '39.5–68.2', s_norm: 0.41, m_norm: 0.63, v_norm: 0.64, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-HELLS-KITCHEN', name: "Hell's Kitchen", city: 'New York', dri_score: 52.3, risk_tier: 'HIGH', data_quality: 'VERIFIED', uncertainty_label: 'HIGH', s_norm: 0.62, m_norm: 0.53, v_norm: 0.46, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-SUNSET-PARK', name: 'Sunset Park', city: 'New York', dri_score: 47.9, risk_tier: 'MODERATE', data_quality: 'PROVISIONAL_UNOBSERVED', uncertainty_label: 'UNOBSERVED_CONSERVATIVE_SPANNING_LOW_TO_HIGH', dri_range: '24.1–64.1', s_norm: 0.32, m_norm: 0.58, v_norm: 0.61, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-FLATBUSH', name: 'Flatbush', city: 'New York', dri_score: 45.2, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.28, m_norm: 0.56, v_norm: 0.62, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-JACKSON-HEIGHTS', name: 'Jackson Heights', city: 'New York', dri_score: 41.8, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.25, m_norm: 0.52, v_norm: 0.57, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-GREENPOINT', name: 'Greenpoint', city: 'New York', dri_score: 39.5, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.44, m_norm: 0.42, v_norm: 0.41, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-FORT-GREENE', name: 'Fort Greene', city: 'New York', dri_score: 36.2, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.35, m_norm: 0.41, v_norm: 0.46, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-KINGSBRIDGE', name: 'Kingsbridge', city: 'New York', dri_score: 34.7, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.18, m_norm: 0.44, v_norm: 0.60, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-FLUSHING', name: 'Flushing', city: 'New York', dri_score: 31.0, risk_tier: 'MODERATE', data_quality: 'VERIFIED', uncertainty_label: 'MODERATE', s_norm: 0.30, m_norm: 0.32, v_norm: 0.52, computed_at: new Date().toISOString() },
  { tract_id: 'NYC-ASTORIA', name: 'Astoria', city: 'New York', dri_score: 23.4, risk_tier: 'LOW', data_quality: 'VERIFIED', uncertainty_label: 'LOW', s_norm: 0.12, m_norm: 0.28, v_norm: 0.44, computed_at: new Date().toISOString() },
]

export const DEMO_PROJECTS: GreenProject[] = [
  {
    project_id: 'p-1',
    name: 'High Line Extension',
    city: 'New York',
    project_type: 'Urban Park',
    lifecycle_stage: 'Under Construction',
    capital_budget_usd: 85_000_000,
    description: 'Elevated greenway extending through Chelsea and Hudson Yards with bioswales.',
    geometry: makeCorridor(-74.007, 40.748, -74.001, 40.756, 300),
  },
  {
    project_id: 'p-2',
    name: 'East Side Coastal Resiliency',
    city: 'New York',
    project_type: 'Flood Wall',
    lifecycle_stage: 'Approved',
    capital_budget_usd: 1_450_000_000,
    description: '2.4-mile integrated flood protection system along the Lower East Side waterfront.',
    geometry: makeCorridor(-73.978, 40.710, -73.972, 40.732, 350),
  },
  {
    project_id: 'p-3',
    name: 'South Bronx Greenway',
    city: 'New York',
    project_type: 'Greenway',
    lifecycle_stage: 'Proposed',
    capital_budget_usd: 45_000_000,
    description: 'Waterfront multi-use path connecting Mott Haven and Hunts Point.',
    geometry: makeCorridor(-73.922, 40.801, -73.910, 40.812, 300),
  },
  {
    project_id: 'p-4',
    name: 'Brooklyn Waterfront Greenway',
    city: 'New York',
    project_type: 'Urban Park',
    lifecycle_stage: 'Under Construction',
    capital_budget_usd: 120_000_000,
    description: 'Stormwater park and promenade running along Williamsburg coastline.',
    geometry: makeCorridor(-73.968, 40.710, -73.959, 40.728, 300),
  },
  {
    project_id: 'p-5',
    name: 'Queens Boulevard Greenway',
    city: 'New York',
    project_type: 'Greenway',
    lifecycle_stage: 'Approved',
    capital_budget_usd: 60_000_000,
    description: 'Linear urban park, bioswale corridor and separated bike network in Flushing.',
    geometry: makeCorridor(-73.848, 40.758, -73.831, 40.768, 320),
  },
]

export const DEMO_ALERTS: Alert[] = [
  {
    alert_id: 'alt-001',
    tract_id: 'NYC-MOTT-HAVEN',
    tract_name: 'Mott Haven',
    city: 'New York',
    dri_score: 83.4,
    risk_tier: 'CRITICAL',
    trigger_type: 'DRI_THRESHOLD_CROSSED',
    status: 'PENDING',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    zoning_citations: [
      {
        document_title: 'South Bronx Environmental Resilience Plan — NYC DCP',
        publication_date: '2024-04-12',
        page: 54,
        clause: 'Section 6.2 — Anti-Displacement Safeguards',
        exact_quote: 'Any capital improvement exceeding $25M in environmental infrastructure requires municipal deployment of emergency rent-stabilization and legal clinics when displacement risk exceeds critical thresholds.',
      },
    ],
  },
  {
    alert_id: 'alt-002',
    tract_id: 'NYC-SOUTH-BRONX',
    tract_name: 'South Bronx',
    city: 'New York',
    dri_score: 79.8,
    risk_tier: 'CRITICAL',
    trigger_type: 'DRI_THRESHOLD_CROSSED',
    status: 'PENDING',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    zoning_citations: [
      {
        document_title: 'Citywide Climate Adaptation Framework — Chapter 9',
        publication_date: '2023-11-20',
        page: 112,
        clause: 'Article 4(b) — Mandatory Inclusionary Zoning',
        exact_quote: 'Parcels located within 2,000m of newly announced green buffers must enforce 40% permanent affordability covenants.',
      },
    ],
  },
  {
    alert_id: 'alt-003',
    tract_id: 'NYC-LOWER-EAST-SIDE',
    tract_name: 'Lower East Side',
    city: 'New York',
    dri_score: 76.5,
    risk_tier: 'CRITICAL',
    trigger_type: 'DRI_THRESHOLD_CROSSED',
    status: 'APPROVED',
    approved_by: 'Jane Doe (Chief Urban Planner)',
    approved_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    planner_notes: 'Targeted tenant clinic dispatched to Avenue D. Emergency CLT land banking request submitted to City Council.',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    zoning_citations: [
      {
        document_title: 'East Side Coastal Resiliency Project FEIS',
        publication_date: '2023-08-01',
        page: 88,
        clause: 'Housing Element Section 3',
        exact_quote: 'Displacement mitigation protocol triggers upon DRI crossing 75.0 index boundary.',
      },
    ],
  },
]

