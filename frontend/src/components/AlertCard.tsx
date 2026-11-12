'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import type { Alert } from '@/lib/types'
import { RiskBadge } from './RiskBadge'

const statusConfig = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', Icon: Clock },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-800 border-green-200', Icon: CheckCircle },
  DISMISSED: { label: 'Dismissed', className: 'bg-gray-200 text-gray-700 border-gray-300', Icon: XCircle },
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface Props {
  alert: Alert
  onApprove: (alert: Alert) => void
  onDismiss: (alert: Alert) => void
}

export function AlertCard({ alert, onApprove, onDismiss }: Props) {
  const [citationsOpen, setCitationsOpen] = useState(false)
  const statusCfg = statusConfig[alert.status] ?? statusConfig.PENDING
  const { Icon: StatusIcon } = statusCfg

  return (
    <div className={clsx(
      'bg-gray-900 border rounded-xl overflow-hidden transition-all',
      alert.status === 'PENDING' ? 'border-yellow-700/50' :
      alert.status === 'APPROVED' ? 'border-green-700/50' : 'border-gray-700/50'
    )}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-100 text-base truncate">{alert.tract_name}</h3>
            <span className="text-gray-500 text-sm">&mdash; {alert.city}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <RiskBadge tier={alert.risk_tier} />
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                statusCfg.className
              )}
            >
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              DRI: <span className="text-gray-200 font-semibold">{alert.dri_score.toFixed(1)}</span>
            </span>
            <span className="text-xs text-gray-600">•</span>
            <span className="text-xs text-gray-500">{alert.trigger_type}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-right flex-shrink-0">
          <div>{formatDate(alert.created_at)}</div>
          <div className="text-gray-600 mt-0.5 font-mono text-[10px]">{alert.alert_id.slice(0, 8)}…</div>
        </div>
      </div>

      {/* Planner notes */}
      {alert.planner_notes && (
        <div className="px-5 pb-3">
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 italic">
            📝 {alert.planner_notes}
          </div>
        </div>
      )}

      {/* Approval info */}
      {alert.status === 'APPROVED' && alert.approved_by && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Approved by <strong>{alert.approved_by}</strong></span>
            {alert.approved_at && <span className="text-gray-500">on {formatDate(alert.approved_at)}</span>}
          </div>
        </div>
      )}

      {/* Zoning citations */}
      {alert.zoning_citations && alert.zoning_citations.length > 0 && (
        <div className="px-5 pb-3">
          <button
            onClick={() => setCitationsOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{alert.zoning_citations.length} zoning citation{alert.zoning_citations.length !== 1 ? 's' : ''}</span>
            {citationsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {citationsOpen && (
            <div className="mt-2 space-y-2">
              {alert.zoning_citations.map((citation, idx) => (
                <div key={idx} className="bg-gray-800 rounded-lg px-3 py-2.5 text-xs space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-semibold text-gray-200">{citation.document_title}</span>
                    <span className="text-gray-500 flex-shrink-0">
                      p.{citation.page} · {citation.publication_date}
                    </span>
                  </div>
                  <div className="text-gray-400 font-medium">{citation.clause}</div>
                  <blockquote className="text-gray-500 italic border-l-2 border-gray-600 pl-2">
                    &ldquo;{citation.exact_quote}&rdquo;
                  </blockquote>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions for PENDING */}
      {alert.status === 'PENDING' && (
        <div className="px-5 py-3 border-t border-gray-800 flex gap-2 justify-end">
          <button
            onClick={() => onDismiss(alert)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border border-gray-700"
          >
            <XCircle className="w-3.5 h-3.5" />
            Dismiss
          </button>
          <button
            onClick={() => onApprove(alert)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-700 text-white hover:bg-green-600 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Approve
          </button>
        </div>
      )}
    </div>
  )
}
