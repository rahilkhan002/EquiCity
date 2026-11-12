'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { Alert } from '@/lib/types'
import { AlertCard } from '@/components/AlertCard'
import { RefreshCw, AlertTriangle, CheckCircle, Bell, XCircle, X } from 'lucide-react'
import { DEMO_ALERTS } from '@/lib/demoData'

type FilterTab = 'ALL' | 'PENDING' | 'APPROVED' | 'DISMISSED'

const TABS: { key: FilterTab; label: string; Icon: any }[] = [
  { key: 'ALL', label: 'All', Icon: Bell },
  { key: 'PENDING', label: 'Pending', Icon: AlertTriangle },
  { key: 'APPROVED', label: 'Approved', Icon: CheckCircle },
  { key: 'DISMISSED', label: 'Dismissed', Icon: XCircle },
]

interface ApproveModalProps {
  alert: Alert | null
  onClose: () => void
  onConfirm: (plannerName: string, notes: string) => Promise<void>
}

function ApproveModal({ alert, onClose, onConfirm }: ApproveModalProps) {
  const [plannerName, setPlannerName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!alert) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plannerName.trim()) { setError('Planner name is required'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(plannerName.trim(), notes.trim())
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to approve alert')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-100">Approve Alert</h3>
            <p className="text-xs text-gray-500 mt-0.5">{alert.tract_name} — {alert.city}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">
              Planner Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={plannerName}
              onChange={e => setPlannerName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any review notes…"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-green-700 text-white hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Approving…</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5" /> Confirm Approval</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [approveTarget, setApproveTarget] = useState<Alert | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchAlerts = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const data = await api.listAlerts()
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data as Alert[])
      } else {
        setAlerts(DEMO_ALERTS)
      }
    } catch (err: any) {
      setAlerts(DEMO_ALERTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    intervalRef.current = setInterval(() => fetchAlerts(false), 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAlerts])

  const handleApprove = useCallback((alert: Alert) => {
    setApproveTarget(alert)
  }, [])

  const handleApproveConfirm = useCallback(async (plannerName: string, notes: string) => {
    if (!approveTarget) return
    await api.approveAlert(approveTarget.alert_id, plannerName, notes || undefined)
    setAlerts(prev =>
      prev.map(a =>
        a.alert_id === approveTarget.alert_id
          ? { ...a, status: 'APPROVED', approved_by: plannerName, approved_at: new Date().toISOString(), planner_notes: notes || a.planner_notes }
          : a
      )
    )
  }, [approveTarget])

  const handleDismiss = useCallback(async (targetAlert: Alert) => {
    if (!confirm(`Dismiss alert for ${targetAlert.tract_name}?`)) return
    try {
      await api.dismissAlert(targetAlert.alert_id)
      setAlerts(prev =>
        prev.map(a =>
          a.alert_id === targetAlert.alert_id ? { ...a, status: 'DISMISSED' } : a
        )
      )
    } catch (err: any) {
      window.alert(`Failed to dismiss: ${err.message}`)
    }
  }, [])

  const filteredAlerts = alerts.filter(a => activeTab === 'ALL' || a.status === activeTab)
  const pendingCount = alerts.filter(a => a.status === 'PENDING').length

  const tabCounts: Record<FilterTab, number> = {
    ALL: alerts.length,
    PENDING: alerts.filter(a => a.status === 'PENDING').length,
    APPROVED: alerts.filter(a => a.status === 'APPROVED').length,
    DISMISSED: alerts.filter(a => a.status === 'DISMISSED').length,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            NGO Displacement Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated alerts when DRI crosses 75 — review and approve for planner action.
          </p>
        </div>
        <button
          onClick={() => fetchAlerts()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Pending summary banner */}
      {pendingCount > 0 && (
        <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <span className="text-sm text-yellow-200">
            <strong>{pendingCount}</strong> pending alert{pendingCount !== 1 ? 's' : ''} requiring planner action.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Make sure the backend is running at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}.
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded-xl mb-5">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-gray-700 text-gray-100 shadow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {tabCounts[key] > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeTab === key ? 'bg-gray-600 text-gray-200' : 'bg-gray-700 text-gray-500'
              }`}>
                {tabCounts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && alerts.length === 0 && (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-green-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading alerts…</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredAlerts.length === 0 && !error && (
        <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
          <div className="text-5xl mb-4">
            {activeTab === 'PENDING' ? '✅' : activeTab === 'APPROVED' ? '📋' : activeTab === 'DISMISSED' ? '🗑️' : '🔔'}
          </div>
          <p className="text-gray-300 font-medium text-sm">
            {activeTab === 'ALL'
              ? 'No alerts yet'
              : `No ${activeTab.toLowerCase()} alerts`}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {activeTab === 'PENDING'
              ? 'All caught up! No pending alerts need your attention.'
              : 'Alerts will appear here when DRI crosses 75 for a census tract.'}
          </p>
        </div>
      )}

      {/* Alert cards */}
      <div className="space-y-4">
        {filteredAlerts.map(alert => (
          <AlertCard
            key={alert.alert_id}
            alert={alert}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center mt-6 text-xs text-gray-600">
        Auto-refreshes every 30 seconds
      </div>

      {/* Approve modal */}
      <ApproveModal
        alert={approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApproveConfirm}
      />
    </div>
  )
}
