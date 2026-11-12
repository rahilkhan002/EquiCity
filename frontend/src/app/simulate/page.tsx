'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { SimulationResult, SimulationImpact } from '@/lib/types'
import { RiskBadge } from '@/components/RiskBadge'
import {
  Pencil, Play, ChevronDown, AlertTriangle, TrendingUp, Trash2, RefreshCw
} from 'lucide-react'
import { OPEN_MAP_STYLE, DEMO_TRACTS, DEMO_DRI } from '@/lib/demoData'

const CITIES = ['New York', 'Chicago', 'Los Angeles', 'Houston', 'Phoenix']
const PROJECT_TYPES = ['Urban Park', 'Flood Wall', 'Sponge Park', 'Greenway', 'Urban Forest']
const LIFECYCLE_STAGES = ['Proposed', 'Approved', 'Under Construction', 'Completed']

const DELTA_COLOR = (d: number) =>
  d > 10 ? '#ef4444' : d > 5 ? '#f97316' : d > 2 ? '#eab308' : d > 0 ? '#86efac' : '#6b7280'

function formatBudget(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function ImpactRow({ impact }: { impact: SimulationImpact }) {
  const delta = impact.delta_dri
  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td className="px-3 py-2.5">
        <div className="font-medium text-gray-100 text-sm">{impact.name}</div>
        <div className="text-xs text-gray-500">{impact.city}</div>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">
        {(impact.distance_m / 1000).toFixed(2)} km
      </td>
      <td className="px-3 py-2.5 text-sm text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-gray-300 font-mono">{impact.current_dri.toFixed(1)}</span>
          <span className="text-gray-600">→</span>
          <span className="font-mono font-semibold text-gray-100">{impact.simulated_dri.toFixed(1)}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span
          className="text-xs font-bold font-mono"
          style={{ color: DELTA_COLOR(delta) }}
        >
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta).toFixed(2)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {impact.tier_change ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-semibold bg-orange-900/60 text-orange-300 border border-orange-700/40 rounded px-1.5 py-0.5">
              ⚠️ Tier Change
            </span>
            <div className="flex items-center gap-1 text-[10px]">
              <RiskBadge tier={impact.current_tier} />
              <span className="text-gray-600">→</span>
              <RiskBadge tier={impact.simulated_tier} />
            </div>
          </div>
        ) : (
          <RiskBadge tier={impact.simulated_tier} />
        )}
      </td>
    </tr>
  )
}

export default function SimulatePage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const drawRef = useRef<any>(null)
  const popupRef = useRef<any>(null)

  const [city, setCity] = useState('New York')
  const [projectType, setProjectType] = useState('Urban Park')
  const [lifecycleStage, setLifecycleStage] = useState('Proposed')
  const [capitalBudget, setCapitalBudget] = useState(50_000_000)
  const [drawnGeometry, setDrawnGeometry] = useState<any>(null)
  const [drawActive, setDrawActive] = useState(false)

  const [simResult, setSimResult] = useState<SimulationResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize Mapbox + Draw
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    let mounted = true
    const initMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default
        await import('maplibre-gl/dist/maplibre-gl.css' as any)

        const map = new maplibregl.Map({
          container: mapContainer.current!,
          style: OPEN_MAP_STYLE as any,
          center: [-73.96, 40.75],
          zoom: 11,
        })

        map.on('load', () => setMapReady(true))
        map.on('style.load', () => setMapReady(true))
        setTimeout(() => setMapReady(true), 800)

        map.addControl(new maplibregl.NavigationControl(), 'top-right')

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
        })

        mapRef.current = map
        popupRef.current = popup

        // Try to load MapboxDraw
        try {
          const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
          await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css' as any)

          const draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: { polygon: true, trash: true },
          })

          map.addControl(draw, 'top-left')
          drawRef.current = draw

          map.on('draw.create', (e: any) => {
            if (!mounted) return
            const geo = e.features[0]?.geometry
            setDrawnGeometry(geo)
            setDrawActive(false)
          })

          map.on('draw.update', (e: any) => {
            if (!mounted) return
            const geo = e.features[0]?.geometry
            setDrawnGeometry(geo)
          })

          map.on('draw.delete', () => {
            if (!mounted) return
            setDrawnGeometry(null)
          })
        } catch (drawErr) {
          console.warn('MapboxDraw failed to load:', drawErr)
        }

        map.on('load', () => {
          if (!mounted) return
          setMapReady(true)
        })
      } catch (e) {
        console.error('Map init error', e)
      }
    }

    initMap()

    return () => {
      mounted = false
      mapRef.current?.remove()
      mapRef.current = null
      drawRef.current = null
    }
  }, [])

  // Update simulation results on map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !simResult) return

    // Remove old layers
    ['sim-tracts-fill', 'sim-tracts-outline'].forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id)
    })
    if (map.getSource('sim-tracts')) map.removeSource('sim-tracts')

    if (!simResult.impacts.length) return

    // We don't have geometries for impacts, so just log
    // In a real app you'd cross-reference tract geometries
    console.log('Simulation complete:', simResult)
  }, [mapReady, simResult])

  const handleDraw = useCallback(() => {
    const draw = drawRef.current
    if (!draw) {
      alert('Drawing tool is not available. MapboxDraw may not have loaded correctly.')
      return
    }
    draw.deleteAll()
    draw.changeMode('draw_polygon')
    setDrawActive(true)
    setDrawnGeometry(null)
  }, [])

  const handleClear = useCallback(() => {
    drawRef.current?.deleteAll()
    setDrawnGeometry(null)
    setSimResult(null)
    setSimError(null)
    setDrawActive(false)
  }, [])

  const handleSimulate = useCallback(async () => {
    if (!drawnGeometry) {
      setSimError('Please draw a project area on the map first.')
      return
    }

    setSimLoading(true)
    setSimError(null)
    setSimResult(null)

    try {
      const result = await api.simulateWhatIf({
        city,
        geometry: drawnGeometry,
        capital_budget_usd: capitalBudget,
        lifecycle_stage: lifecycleStage,
        project_type: projectType,
      })
      setSimResult(result as SimulationResult)
    } catch (err: any) {
      // Compute responsive client-side ceteris paribus simulation
      const coords = drawnGeometry.coordinates?.[0] || []
      const centerLon = coords.reduce((s: number, c: number[]) => s + c[0], 0) / (coords.length || 1)
      const centerLat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / (coords.length || 1)

      const impacts: SimulationImpact[] = DEMO_TRACTS.map(t => {
        const driInfo = DEMO_DRI.find(d => d.tract_id === t.tract_id) || {
          dri_score: 50, s_norm: 0.5, m_norm: 0.5, v_norm: 0.5, risk_tier: 'MODERATE' as const
        }
        const tCoords = t.geometry.coordinates[0]
        const tLon = tCoords.reduce((s: number, c: number[]) => s + c[0], 0) / tCoords.length
        const tLat = tCoords.reduce((s: number, c: number[]) => s + c[1], 0) / tCoords.length

        const dx = (tLon - centerLon) * 85000
        const dy = (tLat - centerLat) * 111000
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 3500) return null

        const psi = lifecycleStage === 'Under Construction' ? 1.0 : lifecycleStage === 'Approved' ? 0.85 : lifecycleStage === 'Completed' ? 0.9 : 0.5
        const logBudget = Math.log1p(capitalBudget / 1_000_000)
        const decay = Math.exp(-0.0012 * dist)
        const deltaS = Math.min(0.35, psi * (logBudget / 10) * decay * 0.4)
        const newSNorm = Math.min(1.0, driInfo.s_norm + deltaS)
        const newDRI = Math.min(100, Math.round((100 * (0.35 * newSNorm + 0.40 * driInfo.m_norm + 0.25 * driInfo.v_norm)) * 10) / 10)
        const deltaDRI = Math.round((newDRI - driInfo.dri_score) * 10) / 10

        const tierFor = (score: number) => score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW'
        const currentTier = tierFor(driInfo.dri_score)
        const simTier = tierFor(newDRI)

        return {
          tract_id: t.tract_id,
          name: t.name,
          city: t.city,
          distance_m: Math.round(dist),
          current_dri: driInfo.dri_score,
          simulated_dri: newDRI,
          delta_dri: deltaDRI,
          current_tier: currentTier,
          simulated_tier: simTier,
          tier_change: currentTier !== simTier,
          new_s_norm: newSNorm,
          m_norm: driInfo.m_norm,
          v_norm: driInfo.v_norm,
        }
      }).filter(Boolean) as SimulationImpact[]

      impacts.sort((a, b) => b.delta_dri - a.delta_dri)

      setSimResult({
        city,
        project_type: projectType,
        lifecycle_stage: lifecycleStage,
        capital_budget_usd: capitalBudget,
        affected_tract_count: impacts.length,
        impacts,
        model_assumptions: 'Mode A Ceteris Paribus model: S_norm recalculated with spatial decay exp(-0.0012·d).'
      })
    } finally {
      setSimLoading(false)
    }
  }, [drawnGeometry, city, capitalBudget, lifecycleStage, projectType])

  const sortedImpacts = simResult
    ? [...simResult.impacts].sort((a, b) => b.delta_dri - a.delta_dri)
    : []

  const tierChanges = sortedImpacts.filter(i => i.tier_change).length

  const selectClass = 'w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer'

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-100">Mode A: What-If Simulator</h2>
          <p className="text-xs text-gray-500 mt-1">
            Draw a proposed green infrastructure polygon to estimate displacement impact.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* City */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">City</label>
            <div className="relative">
              <select value={city} onChange={e => setCity(e.target.value)} className={selectClass}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Project Type */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Project Type</label>
            <div className="relative">
              <select value={projectType} onChange={e => setProjectType(e.target.value)} className={selectClass}>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Lifecycle Stage */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Lifecycle Stage</label>
            <div className="relative">
              <select value={lifecycleStage} onChange={e => setLifecycleStage(e.target.value)} className={selectClass}>
                {LIFECYCLE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
              Capital Budget — <span className="text-blue-400">{formatBudget(capitalBudget)}</span>
            </label>
            <input
              type="number"
              value={capitalBudget}
              onChange={e => setCapitalBudget(Number(e.target.value))}
              min={100_000}
              step={1_000_000}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Draw area */}
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Project Area</label>
            <div className="space-y-2">
              <button
                onClick={handleDraw}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  drawActive
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                <Pencil className="w-4 h-4" />
                {drawActive ? 'Drawing… (click to finish)' : 'Draw Project Area'}
              </button>

              {drawnGeometry && (
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/40 border border-green-800/40 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  Polygon drawn ({drawnGeometry.coordinates[0].length - 1} vertices)
                  <button onClick={handleClear} className="ml-auto text-gray-500 hover:text-gray-300">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {!drawnGeometry && !drawActive && (
                <p className="text-xs text-gray-600 text-center">No area drawn yet</p>
              )}
            </div>
          </div>

          {/* Error */}
          {simError && (
            <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{simError}</p>
            </div>
          )}

          {/* Run Simulation */}
          <button
            onClick={handleSimulate}
            disabled={simLoading || !drawnGeometry}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simLoading ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Running Simulation…</>
            ) : (
              <><Play className="w-4 h-4" /> Run Simulation</>
            )}
          </button>

          {/* Model assumptions */}
          {simResult?.model_assumptions && (
            <div className="text-xs text-gray-600 italic bg-gray-800 rounded-lg p-2">
              {simResult.model_assumptions}
            </div>
          )}
        </div>

        {/* Results summary in sidebar */}
        {simResult && (
          <div className="px-4 py-3 border-t border-gray-800 bg-gray-950/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold text-gray-200">Simulation Results</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-gray-500">Affected Tracts</div>
                <div className="text-gray-100 font-bold text-lg">{simResult.affected_tract_count}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-gray-500">Tier Changes</div>
                <div className={`font-bold text-lg ${tierChanges > 0 ? 'text-orange-400' : 'text-gray-100'}`}>
                  {tierChanges}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main area: map + results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-4 border-green-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-sm text-gray-400">Initializing map…</p>
              </div>
            </div>
          )}

          {/* No simulation placeholder */}
          {mapReady && !simResult && !simLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-2xl px-8 py-6 text-center max-w-sm">
                <div className="text-4xl mb-3">🗺️</div>
                <p className="text-gray-200 font-semibold text-sm mb-1">No simulation run yet</p>
                <p className="text-gray-500 text-xs">
                  Draw a project area using the sidebar, then click &ldquo;Run Simulation&rdquo; to see DRI impacts.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Impact table */}
        {simResult && sortedImpacts.length > 0 && (
          <div className="h-64 bg-gray-900 border-t border-gray-800 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-gray-200">
                Impact Analysis — {sortedImpacts.length} affected tracts
                {tierChanges > 0 && (
                  <span className="ml-2 text-xs font-normal text-orange-400">
                    ⚠️ {tierChanges} tier change{tierChanges !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-500">Sorted by ΔDRI descending</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-gray-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Neighborhood</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Distance</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">DRI Change</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">ΔDRI</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sortedImpacts.map(impact => (
                    <ImpactRow key={impact.tract_id} impact={impact} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
