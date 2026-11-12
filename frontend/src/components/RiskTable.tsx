'use client'

import { useState, useMemo } from 'react'
import clsx from 'clsx'
import type { TractDRI } from '@/lib/types'
import { RiskBadge } from './RiskBadge'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortKey = 'name' | 'dri_score' | 'risk_tier' | 'data_quality' | 's_norm' | 'm_norm' | 'v_norm'
type SortDir = 'asc' | 'desc'

const tierOrder = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 }

const qualityColors: Record<string, string> = {
  VERIFIED: 'text-green-400',
  PROVISIONAL_PARTIAL: 'text-yellow-400',
  PROVISIONAL_UNOBSERVED: 'text-orange-400',
}

const qualityLabels: Record<string, string> = {
  VERIFIED: 'Verified',
  PROVISIONAL_PARTIAL: 'Partial',
  PROVISIONAL_UNOBSERVED: 'Unobserved',
}

const rowTierBg: Record<string, string> = {
  LOW: 'hover:bg-green-950/40',
  MODERATE: 'hover:bg-yellow-950/40',
  HIGH: 'hover:bg-orange-950/40',
  CRITICAL: 'hover:bg-red-950/40',
}

const selectedTierBg: Record<string, string> = {
  LOW: 'bg-green-900/30 border-l-2 border-green-400',
  MODERATE: 'bg-yellow-900/30 border-l-2 border-yellow-400',
  HIGH: 'bg-orange-900/30 border-l-2 border-orange-400',
  CRITICAL: 'bg-red-900/30 border-l-2 border-red-400',
}

const DRI_BAR_GRADIENT =
  'linear-gradient(to right, #22c55e 0%, #eab308 40%, #f97316 65%, #ef4444 85%, #991b1b 100%)'

function DriBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-20 h-2 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: DRI_BAR_GRADIENT,
          }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-gray-200 w-8 text-right">{pct.toFixed(1)}</span>
    </div>
  )
}

interface Props {
  tracts: TractDRI[]
  selectedTractId?: string
  onSelectTract: (tract: TractDRI) => void
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-gray-500 inline ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-blue-400 inline ml-1" />
    : <ChevronDown className="w-3 h-3 text-blue-400 inline ml-1" />
}

export function RiskTable({ tracts, selectedTractId, onSelectTract }: Props) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('dri_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return tracts.filter(t =>
      !q || t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q) || t.tract_id.includes(q)
    )
  }, [tracts, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'risk_tier') {
        va = tierOrder[a.risk_tier] ?? 0
        vb = tierOrder[b.risk_tier] ?? 0
      } else {
        va = a[sortKey]
        vb = b[sortKey]
      }
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const thClass = 'px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 transition-colors whitespace-nowrap'

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search neighborhoods…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{sorted.length} of {tracts.length} tracts</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr>
              <th className={thClass} onClick={() => handleSort('name')}>
                Neighborhood <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort('dri_score')}>
                DRI <SortIcon col="dri_score" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort('risk_tier')}>
                Tier <SortIcon col="risk_tier" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass} onClick={() => handleSort('data_quality')}>
                Quality <SortIcon col="data_quality" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={thClass + ' text-center'}>S / M / V</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {sorted.map(tract => {
              const isSelected = tract.tract_id === selectedTractId
              return (
                <tr
                  key={tract.tract_id}
                  onClick={() => onSelectTract(tract)}
                  className={clsx(
                    'cursor-pointer transition-colors',
                    isSelected
                      ? selectedTierBg[tract.risk_tier] ?? 'bg-blue-900/30 border-l-2 border-blue-400'
                      : rowTierBg[tract.risk_tier] ?? 'hover:bg-gray-800/50'
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-100 truncate max-w-[140px]" title={tract.name}>
                      {tract.name}
                    </div>
                    <div className="text-xs text-gray-500">{tract.city}</div>
                  </td>
                  <td className="px-3 py-2">
                    <DriBar score={tract.dri_score} />
                    {tract.dri_range && (
                      <div className="text-xs text-gray-500 mt-0.5">{tract.dri_range}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <RiskBadge tier={tract.risk_tier} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={clsx('text-xs font-medium', qualityColors[tract.data_quality] ?? 'text-gray-400')}>
                      {qualityLabels[tract.data_quality] ?? tract.data_quality}
                    </span>
                    {tract.uncertainty_label && (
                      <div className="text-xs text-gray-600 truncate max-w-[80px]" title={tract.uncertainty_label}>
                        {tract.uncertainty_label}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-center">
                    <span className="text-green-400">{(tract.s_norm * 100).toFixed(0)}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-blue-400">{(tract.m_norm * 100).toFixed(0)}</span>
                    <span className="text-gray-600"> / </span>
                    <span className="text-purple-400">{(tract.v_norm * 100).toFixed(0)}</span>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500 text-sm">
                  No tracts match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
