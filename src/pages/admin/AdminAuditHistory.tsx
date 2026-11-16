import React, { useState, useMemo } from 'react'
import { History, Search, Shield, Filter, Download, User, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { getAuditLogs } from '../../lib/dataService'
import { formatDateTime } from '../../lib/utils'
import Papa from 'papaparse'
import { useToast } from '../../store/ToastContext'

export default function AdminAuditHistory() {
  const { toast } = useToast()
  const logs = useMemo(() => getAuditLogs(), [])

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = l.actor_name.toLowerCase().includes(search.toLowerCase()) ||
                          l.action.toLowerCase().includes(search.toLowerCase()) ||
                          l.entity_reference.toLowerCase().includes(search.toLowerCase()) ||
                          l.change_summary.toLowerCase().includes(search.toLowerCase())
      const matchAction = actionFilter === 'all' || l.action.toLowerCase().includes(actionFilter.toLowerCase())
      return matchSearch && matchAction
    })
  }, [logs, search, actionFilter])

  const handleExportCSV = () => {
    const csv = Papa.unparse(filteredLogs)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `StockFlow_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('success', 'Export Ready', 'Audit history exported to CSV.')
  }

  return (
    <AdminLayout title="Append-Only Audit History">
      <div className="space-y-4">
        {/* Intro */}
        <div className="p-4 bg-navy-DEFAULT text-white rounded-2xl shadow-card flex items-start gap-3">
          <Shield className="w-5 h-5 text-teal-DEFAULT shrink-0 mt-0.5" />
          <div className="text-xs">
            <h3 className="font-bold text-sm text-white">Immutable Security & Compliance Audit Log</h3>
            <p className="text-navy-100/80 mt-0.5">
              Tracks all security events, employee creations, stock ledger approvals, physical count adjustments, and rate revisions. Audit records cannot be altered or deleted.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search actor, action, reference or changes..."
                  className="input-field pl-9 text-xs"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <select
                className="input-field text-xs w-36 uppercase"
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
              >
                <option value="all">All Actions</option>
                <option value="APPROVE">Approvals</option>
                <option value="REJECT">Rejections</option>
                <option value="SUBMIT">Submissions</option>
                <option value="POST">Postings</option>
                <option value="STAFF">Staff Events</option>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4 text-teal-DEFAULT" /> Export Audit Log
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor / User</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Entity Ref</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Change Summary</th>
                  <th className="py-3 px-4 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-brand-bg/60 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap text-brand-textSecondary font-medium">
                      {formatDateTime(l.timestamp)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-navy-DEFAULT block">{l.actor_name}</span>
                      <span className="text-[10px] text-brand-textSecondary uppercase font-semibold">{l.actor_role}</span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-teal-DEFAULT uppercase text-[10px]">
                      {l.action.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-navy-DEFAULT">
                      {l.entity_reference}
                    </td>
                    <td className="py-2.5 px-4 text-brand-textSecondary">
                      {l.warehouse_name || 'Central'}
                    </td>
                    <td className="py-2.5 px-4 text-brand-textPrimary max-w-xs truncate">
                      {l.change_summary}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full badge-success">
                        {l.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
