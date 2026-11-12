const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }
  return res.json()
}

export const api = {
  // Tracts
  listTracts: (city?: string) =>
    apiFetch<any[]>(`/tracts${city ? `?city=${city}` : ''}`),

  getCityDRI: (city: string) =>
    apiFetch<any[]>(`/tracts/city/${city}/dri-all`),

  // Projects
  listProjects: (city?: string) =>
    apiFetch<any[]>(`/projects${city ? `?city=${city}` : ''}`),

  createProject: (data: any) =>
    apiFetch<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  // Simulate
  simulateWhatIf: (data: {
    city: string
    geometry: any
    capital_budget_usd: number
    lifecycle_stage: string
    project_type: string
  }) =>
    apiFetch<any>('/simulate/what-if', { method: 'POST', body: JSON.stringify(data) }),

  // Alerts
  listAlerts: (status?: string, city?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (city) params.set('city', city)
    return apiFetch<any[]>(`/alerts?${params}`)
  },

  approveAlert: (alertId: string, plannerName: string, notes?: string) => {
    const params = new URLSearchParams({ planner_name: plannerName })
    if (notes) params.set('notes', notes)
    return apiFetch<any>(`/alerts/${alertId}/approve?${params}`, { method: 'POST' })
  },

  dismissAlert: (alertId: string) =>
    apiFetch<any>(`/alerts/${alertId}/dismiss`, { method: 'POST' }),
}
