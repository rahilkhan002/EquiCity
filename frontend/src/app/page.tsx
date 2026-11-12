'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { TractDRI, Tract, GreenProject } from '@/lib/types'
import { RiskTable } from '@/components/RiskTable'
import { AlertTriangle, Layers, RefreshCw, ChevronDown, CheckCircle, Database } from 'lucide-react'
import { DEMO_TRACTS, DEMO_DRI, DEMO_PROJECTS, OPEN_MAP_STYLE } from '@/lib/demoData'

const TIER_COLORS: Record<string, string> = {
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
}

const CITIES = ['New York', 'Chicago', 'Los Angeles', 'Houston', 'Phoenix']

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-3 py-1.5">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs font-bold text-gray-200">{count}</span>
    </div>
  )
}

export default function DashboardPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const popupRef = useRef<any>(null)

  const [city, setCity] = useState('New York')
  const [driData, setDriData] = useState<TractDRI[]>([])
  const [tractGeos, setTractGeos] = useState<Tract[]>([])
  const [projects, setProjects] = useState<GreenProject[]>([])
  const [selectedTract, setSelectedTract] = useState<TractDRI | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // Tier counts
  const tierCounts = {
    LOW: driData.filter(t => t.risk_tier === 'LOW').length,
    MODERATE: driData.filter(t => t.risk_tier === 'MODERATE').length,
    HIGH: driData.filter(t => t.risk_tier === 'HIGH').length,
    CRITICAL: driData.filter(t => t.risk_tier === 'CRITICAL').length,
  }

  // Fetch city data
  const fetchData = useCallback(async (c: string) => {
    setLoading(true)
    setError(null)
    try {
      const [dri, geos, proj] = await Promise.all([
        api.getCityDRI(c).catch(() => []),
        api.listTracts(c).catch(() => []),
        api.listProjects(c).catch(() => []),
      ])
      if (Array.isArray(dri) && dri.length > 0 && Array.isArray(geos) && geos.length > 0) {
        setDriData(dri as TractDRI[])
        setTractGeos(geos as Tract[])
        setProjects(Array.isArray(proj) ? (proj as GreenProject[]) : DEMO_PROJECTS)
        setIsLive(true)
      } else {
        // Use comprehensive pre-seeded dataset if live backend is initializing
        setDriData(DEMO_DRI)
        setTractGeos(DEMO_TRACTS)
        setProjects(DEMO_PROJECTS)
        setIsLive(false)
      }
    } catch (err: any) {
      setDriData(DEMO_DRI)
      setTractGeos(DEMO_TRACTS)
      setProjects(DEMO_PROJECTS)
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(city)
  }, [city, fetchData])

  // Initialize Mapbox
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    let map: any
    let popup: any

    const initMap = async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default
        await import('maplibre-gl/dist/maplibre-gl.css' as any)

        map = new maplibregl.Map({
          container: mapContainer.current!,
          style: OPEN_MAP_STYLE as any,
          center: [-73.96, 40.75],
          zoom: 11,
        })

        popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'equicity-popup',
        })

        map.addControl(new maplibregl.NavigationControl(), 'top-right')
        map.addControl(new maplibregl.ScaleControl(), 'bottom-left')

        mapRef.current = map
        popupRef.current = popup

        map.on('load', () => {
          setMapReady(true)
        })
        map.on('style.load', () => {
          setMapReady(true)
        })

        setTimeout(() => {
          setMapReady(true)
        }, 800)
      } catch (e) {
        console.error('Map init error', e)
        setMapReady(true)
      }
    }

    initMap()

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Update map layers when data or mapReady changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const applyLayers = () => {
      if (!map) return
      if (!map.loaded() && !map.isStyleLoaded()) {
        map.once('load', applyLayers)
        setTimeout(applyLayers, 200)
        return
      }

      try {
        // Build DRI lookup map
        const driLookup: Record<string, TractDRI> = {}
        driData.forEach(d => { driLookup[d.tract_id] = d })

        // Build GeoJSON for tracts
        const tractFeatures = tractGeos
          .filter(t => t.geometry && t.geometry.coordinates?.length)
          .map(t => ({
            type: 'Feature' as const,
            id: t.tract_id,
            properties: {
              tract_id: t.tract_id,
              name: t.name,
              city: t.city,
              dri_score: driLookup[t.tract_id]?.dri_score ?? 0,
              risk_tier: driLookup[t.tract_id]?.risk_tier ?? 'LOW',
            },
            geometry: t.geometry,
          }))

        const tractGeoJSON: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: tractFeatures,
        }

        // Build GeoJSON for centroids (for continuous smooth blurred heat shade)
        const centroidFeatures = tractGeos
          .filter(t => t.geometry && t.geometry.coordinates?.length)
          .map(t => {
            const coords = t.geometry.coordinates[0]
            const lng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length
            const lat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length
            const dri = driLookup[t.tract_id]
            return {
              type: 'Feature' as const,
              id: t.tract_id,
              properties: {
                tract_id: t.tract_id,
                name: t.name,
                city: t.city,
                dri_score: dri?.dri_score ?? 0,
                risk_tier: dri?.risk_tier ?? 'LOW',
              },
              geometry: {
                type: 'Point' as const,
                coordinates: [lng, lat],
              },
            }
          })

        const centroidGeoJSON: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: centroidFeatures,
        }

        // Build GeoJSON for projects
        const projectFeatures = projects
          .filter(p => p.geometry && p.geometry.coordinates?.length)
          .map(p => ({
            type: 'Feature' as const,
            properties: { project_id: p.project_id, name: p.name, project_type: p.project_type },
            geometry: p.geometry,
          }))

        const projectGeoJSON: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: projectFeatures,
        }

        // Remove old layers/sources safely
        const cleanupLayers = [
          'tracts-heatmap',
          'tracts-blur-glow',
          'tracts-fill',
          'tracts-outline',
          'tracts-selected',
          'projects-glow',
          'projects-core',
          'projects-fill',
          'projects-outline',
        ]
        cleanupLayers.forEach(id => {
          if (map.getLayer(id)) map.removeLayer(id)
        })
        const cleanupSources = ['tracts', 'tract-centroids', 'projects']
        cleanupSources.forEach(id => {
          if (map.getSource(id)) map.removeSource(id)
        })

        const beforeId = map.getLayer('esri-dark-ref-layer') ? 'esri-dark-ref-layer' : undefined

        // 1. Add Centroids source for smooth blur shade (NO lines!)
        map.addSource('tract-centroids', { type: 'geojson', data: centroidGeoJSON })

        // 2. Continuous Gaussian Heatmap Layer - perfectly smooth blurred shade
        map.addLayer({
          id: 'tracts-heatmap',
          type: 'heatmap',
          source: 'tract-centroids',
          paint: {
            'heatmap-weight': [
              'interpolate', ['linear'], ['get', 'dri_score'],
              0, 0.2,
              100, 1.0,
            ],
            'heatmap-intensity': [
              'interpolate', ['linear'], ['zoom'],
              9, 1.0,
              13, 2.4,
            ],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.15, 'rgba(16, 185, 129, 0.50)', // Emerald
              0.40, 'rgba(234, 179, 8, 0.65)',   // Amber
              0.65, 'rgba(249, 115, 22, 0.80)',  // Orange
              0.88, 'rgba(239, 68, 68, 0.95)',   // Crimson
            ],
            'heatmap-radius': [
              'interpolate', ['linear'], ['zoom'],
              9, 35,
              11, 75,
              14, 140,
            ],
            'heatmap-opacity': 0.85,
          },
        }, beforeId)

        // 3. Radial Soft Feathered Blur Core (circle-blur: 1.0 = 100% smooth edge feathering, NO outline lines)
        map.addLayer({
          id: 'tracts-blur-glow',
          type: 'circle',
          source: 'tract-centroids',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              9, 24,
              11, 52,
              14, 95,
            ],
            'circle-color': [
              'match',
              ['get', 'risk_tier'],
              'LOW', '#10b981',
              'MODERATE', '#eab308',
              'HIGH', '#f97316',
              'CRITICAL', '#ef4444',
              '#6b7280',
            ],
            'circle-blur': 1.0, // Full radial blur / feathered edge with zero lines
            'circle-opacity': 0.70,
          },
        }, beforeId)

        // 4. Add invisible polygon hitboxes for hover popups & click interactions
        map.addSource('tracts', { type: 'geojson', data: tractGeoJSON })
        map.addLayer({
          id: 'tracts-fill',
          type: 'fill',
          source: 'tracts',
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.001, // Invisible sensor hitbox
          },
        })

        // 5. Selected tract soft glowing pulse ring
        map.addLayer({
          id: 'tracts-selected',
          type: 'circle',
          source: 'tract-centroids',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              9, 28,
              11, 56,
              14, 100,
            ],
            'circle-color': 'transparent',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
            'circle-stroke-opacity': ['case', ['==', ['get', 'tract_id'], ''], 0, 0.95],
          },
          filter: ['==', ['get', 'tract_id'], ''],
        })

        // 6. Projects: sleek glowing light ribbons (NO hard polygon boxes!)
        map.addSource('projects', { type: 'geojson', data: projectGeoJSON })

        map.addLayer({
          id: 'projects-glow',
          type: 'line',
          source: 'projects',
          paint: {
            'line-color': '#22d3ee',
            'line-width': 4.5,
            'line-blur': 2.5, // Soft neon blur glow
            'line-opacity': 0.85,
          },
        }, beforeId)

        map.addLayer({
          id: 'projects-core',
          type: 'line',
          source: 'projects',
          paint: {
            'line-color': '#ffffff',
            'line-width': 1.2,
            'line-opacity': 0.9,
          },
        }, beforeId)

        // Fit bounds to tracts if features exist
        if (tractFeatures.length > 0) {
          let minX = 180, minY = 90, maxX = -180, maxY = -90
          tractFeatures.forEach(f => {
            f.geometry.coordinates[0].forEach((c: number[]) => {
              if (c[0] < minX) minX = c[0]
              if (c[0] > maxX) maxX = c[0]
              if (c[1] < minY) minY = c[1]
              if (c[1] > maxY) maxY = c[1]
            })
          })
          map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 50, duration: 800 })
        }

        // Hover popup
        const popup = popupRef.current
        map.off('mouseenter', 'tracts-fill')
        map.on('mouseenter', 'tracts-fill', (e: any) => {
          map.getCanvas().style.cursor = 'pointer'
          const props = e.features?.[0]?.properties
          if (!props || !popup) return
          const html = `
            <div style="background:#111827;border:1px solid #374151;border-radius:8px;padding:10px 14px;font-family:sans-serif;min-width:160px;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
              <div style="font-weight:700;color:#f3f4f6;font-size:13px;margin-bottom:2px;">${props.name}</div>
              <div style="color:#9ca3af;font-size:11px;margin-bottom:8px;">${props.city}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:12px;color:#9ca3af;">DRI Score:</span>
                <span style="font-size:14px;font-weight:700;color:#f3f4f6;">${Number(props.dri_score).toFixed(1)}</span>
                <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;background:${TIER_COLORS[props.risk_tier] || '#6b7280'}33;color:${TIER_COLORS[props.risk_tier] || '#9ca3af'};border:1px solid ${TIER_COLORS[props.risk_tier] || '#6b7280'}66;">${props.risk_tier}</span>
              </div>
            </div>
          `
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map)
        })

        map.off('mouseleave', 'tracts-fill')
        map.on('mouseleave', 'tracts-fill', () => {
          map.getCanvas().style.cursor = ''
          popup?.remove()
        })

        // Click to select tract
        map.off('click', 'tracts-fill')
        map.on('click', 'tracts-fill', (e: any) => {
          const props = e.features?.[0]?.properties
          if (!props) return
          const found = driLookup[props.tract_id]
          if (found) setSelectedTract(found)
        })
      } catch (err) {
        console.error('Error applying map layers:', err)
      }
    }

    applyLayers()
  }, [mapReady, driData, tractGeos, projects])

  // Highlight selected tract
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !map.getLayer('tracts-selected')) return
    map.setFilter('tracts-selected', [
      '==', ['get', 'tract_id'], selectedTract?.tract_id ?? ''
    ])
  }, [selectedTract, mapReady])

  // Fly to selected tract
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedTract) return
    const geo = tractGeos.find(t => t.tract_id === selectedTract.tract_id)
    if (!geo?.geometry?.coordinates?.length) return

    // Compute centroid
    const coords = geo.geometry.coordinates[0]
    const lng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length
    const lat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length
    map.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 })
  }, [selectedTract, tractGeos, mapReady])

  const handleSelectTract = useCallback((tract: TractDRI) => {
    setSelectedTract(tract)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-2.5 flex items-center gap-4 flex-wrap">
        {/* City selector */}
        <div className="relative">
          <select
            value={city}
            onChange={e => { setCity(e.target.value); setSelectedTract(null) }}
            className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">{driData.length} tracts</span>
          <StatBadge label="Low" count={tierCounts.LOW} color={TIER_COLORS.LOW} />
          <StatBadge label="Moderate" count={tierCounts.MODERATE} color={TIER_COLORS.MODERATE} />
          <StatBadge label="High" count={tierCounts.HIGH} color={TIER_COLORS.HIGH} />
          <StatBadge label="Critical" count={tierCounts.CRITICAL} color={TIER_COLORS.CRITICAL} />
        </div>

        {/* Live/Demo Mode indicator */}
        {isLive ? (
          <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs px-2.5 py-1 rounded-full">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Live DB Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800 text-amber-300 text-xs px-2.5 py-1 rounded-full" title="Start MongoDB + Backend at port 8000 for live sync">
            <Database className="w-3.5 h-3.5" />
            <span>Standalone Demo Mode</span>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-1.5 ml-auto">
          <Layers className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500">DRI Choropleth</span>
        </div>

        {/* Refresh */}
        <button
          onClick={() => fetchData(city)}
          disabled={loading}
          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border-b border-red-800 px-5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
          <span className="text-xs text-red-500 ml-2">— Using demo data or check backend at http://localhost:8000</span>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Risk Table */}
        <div className="w-[40%] flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden bg-gray-950">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-green-400 animate-spin mx-auto" />
                <p className="text-sm text-gray-400">Loading DRI data…</p>
              </div>
            </div>
          ) : (
            <RiskTable
              tracts={driData}
              selectedTractId={selectedTract?.tract_id}
              onSelectTract={handleSelectTract}
            />
          )}
        </div>

        {/* Right: Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

          {/* Map loading overlay */}
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center space-y-3">
                <div className="w-10 h-10 rounded-full border-4 border-green-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-sm text-gray-400">Initializing map…</p>
              </div>
            </div>
          )}

          {/* Legend overlay */}
          <div className="absolute bottom-8 right-4 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-xs space-y-1.5 z-10">
            <div className="text-gray-400 font-semibold mb-1 uppercase tracking-wide text-[10px]">DRI Risk Heat Shade</div>
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <div key={tier} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="text-gray-300">{tier.charAt(0) + tier.slice(1).toLowerCase()}</span>
              </div>
            ))}
            <div className="border-t border-gray-700 mt-1.5 pt-1.5 flex items-center gap-2">
              <span className="w-4 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee] flex-shrink-0 inline-block" />
              <span className="text-gray-400">Green Projects</span>
            </div>
          </div>

          {/* Selected tract info */}
          {selectedTract && (
            <div className="absolute top-4 left-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-4 text-sm max-w-xs z-10">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold text-gray-100">{selectedTract.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{selectedTract.city}</div>
                </div>
                <button
                  onClick={() => setSelectedTract(null)}
                  className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0"
                >×</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400">DRI</div>
                  <div className="font-bold text-gray-100 text-base">{selectedTract.dri_score.toFixed(1)}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400">Supply</div>
                  <div className="font-bold text-green-400">{(selectedTract.s_norm * 100).toFixed(0)}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400">Market</div>
                  <div className="font-bold text-blue-400">{(selectedTract.m_norm * 100).toFixed(0)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center">{selectedTract.uncertainty_label}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
