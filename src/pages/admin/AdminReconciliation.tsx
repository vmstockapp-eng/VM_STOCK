import React, { useState, useMemo } from 'react'
import {
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Warehouse as WarehouseIcon,
  Calendar, Check, ShieldAlert, ArrowRight
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import { getPhysicalCounts, approvePhysicalCountAdjustment, getWarehouses } from '../../lib/dataService'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import { formatDate, formatNumber, getStatusColor, getUnitLabel } from '../../lib/utils'
import type { PhysicalCount } from '../../types'

export default function AdminReconciliation() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const warehouses = useMemo(() => getWarehouses(), [])
  const [countsList, setCountsList] = useState<PhysicalCount[]>(() => getPhysicalCounts())
  const [selectedCount, setSelectedCount] = useState<PhysicalCount | null>(null)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  // Pending counts needing reconciliation
  const pendingAudits = useMemo(() => {
    return countsList.filter(c => c.status === 'submitted')
  }, [countsList])

  const pastAudits = useMemo(() => {
    return countsList.filter(c => c.status === 'approved' || c.status === 'rejected')
  }, [countsList])

  const handleApproveReconciliation = () => {
    if (!profile || !selectedCount) return
    try {
      approvePhysicalCountAdjustment(selectedCount.id, profile)
      setCountsList(getPhysicalCounts())
      setConfirmModalOpen(false)
      toast('success', 'Stock Reconciled', `Ledger balances for ${selectedCount.reference_no} updated to match physically counted inventory.`)
    } catch (err: any) {
      toast('error', 'Reconciliation Failed', err.message)
    }
  }

  return (
    <AdminLayout title="Physical Stock Reconciliation">
      <div className="space-y-4">
        {/* Intro Banner */}
        <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-start gap-3">
          <RefreshCw className="w-5 h-5 text-teal-DEFAULT shrink-0 mt-0.5" />
          <div className="text-xs">
            <h3 className="font-bold text-navy-DEFAULT text-sm">Physical Audit & Variance Reconciliation</h3>
            <p className="text-brand-textSecondary mt-0.5">
              Review physical stock count audits submitted by warehouse supervisors. Approving an audit posts atomic ledger adjustments to reconcile system stock balances with real physical yard counts.
            </p>
          </div>
        </div>

        {/* Pending Physical Audits Queue */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="p-4 border-b border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-warning" />
              <h3 className="text-xs font-bold text-navy-DEFAULT uppercase tracking-wider">
                Audits Awaiting Adjustment Reconciliation ({pendingAudits.length})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-brand-border/60">
            {pendingAudits.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-textSecondary">
                ✓ No pending physical count discrepancy audits.
              </div>
            ) : (
              pendingAudits.map(count => {
                const discrepancies = (count.lines || []).filter(l => l.variance !== 0)

                return (
                  <div key={count.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-navy-DEFAULT text-sm">{count.reference_no}</span>
                          <span className="text-xs text-teal-DEFAULT bg-teal-50 px-2 py-0.5 rounded-full font-semibold">
                            {count.warehouse?.name}
                          </span>
                        </div>
                        <p className="text-xs text-brand-textSecondary mt-0.5">
                          Counted by <strong>{count.creator_name}</strong> on {formatDate(count.count_date)}
                        </p>
                      </div>

                      <button
                        onClick={() => { setSelectedCount(count); setConfirmModalOpen(true) }}
                        className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Reconcile & Adjust Ledger</span>
                      </button>
                    </div>

                    {/* Discrepancy Items Table */}
                    <div className="bg-brand-bg rounded-xl border border-brand-border/80 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand-tableHeader text-[10px] text-brand-textSecondary uppercase tracking-wider font-semibold">
                          <tr>
                            <th className="py-2 px-3">Product SKU & Name</th>
                            <th className="py-2 px-3 text-right">System Expected</th>
                            <th className="py-2 px-3 text-right">Physical Count</th>
                            <th className="py-2 px-3 text-right">Variance</th>
                            <th className="py-2 px-3">Staff Reason / Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border/60">
                          {count.lines?.map(l => (
                            <tr key={l.id} className="hover:bg-white/60">
                              <td className="py-2 px-3 font-semibold text-navy-DEFAULT">
                                {l.product?.sku} — {l.product?.name}
                              </td>
                              <td className="py-2 px-3 text-right text-brand-textSecondary font-medium">
                                {formatNumber(l.system_stock)} {getUnitLabel(l.product?.unit)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-navy-DEFAULT">
                                {formatNumber(l.counted_stock)} {getUnitLabel(l.product?.unit)}
                              </td>
                              <td className="py-2 px-3 text-right font-extrabold">
                                <span className={l.variance < 0 ? 'text-brand-error' : l.variance > 0 ? 'text-blue-700' : 'text-brand-success'}>
                                  {l.variance > 0 ? `+${formatNumber(l.variance)}` : formatNumber(l.variance)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-brand-textSecondary text-[11px]">
                                {l.notes || (l.variance === 0 ? 'Matches system ledger' : '-')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Past Reconciliations History */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="p-4 border-b border-brand-border">
            <h3 className="text-xs font-bold text-navy-DEFAULT uppercase tracking-wider">
              Reconciled Physical Audits Archive
            </h3>
          </div>

          <div className="divide-y divide-brand-border/60 text-xs">
            {pastAudits.length === 0 ? (
              <div className="py-8 text-center text-brand-textSecondary">
                No past reconciliation history.
              </div>
            ) : (
              pastAudits.map(c => (
                <div key={c.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-navy-DEFAULT">{c.reference_no}</span>
                    <span className="text-brand-textSecondary ml-2">• {c.warehouse?.name} • {formatDate(c.count_date)}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full badge-success">
                    {c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal: Confirm Reconciliation Posting */}
        <Modal
          open={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title={`Confirm Stock Reconciliation: ${selectedCount?.reference_no}`}
          size="md"
        >
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-brand-warning space-y-1">
              <p className="font-bold text-navy-DEFAULT">Review Variance Adjustments:</p>
              <p>
                Approving this reconciliation will post adjustments to the stock balance of <strong>{selectedCount?.warehouse?.name}</strong> so system records match physical yard counts.
              </p>
            </div>

            <div className="p-3 bg-brand-bg rounded-xl border border-brand-border space-y-1">
              <span className="text-brand-textSecondary block text-[10px] uppercase font-bold">Discrepant Items</span>
              <ul className="list-disc pl-4 space-y-1">
                {(selectedCount?.lines || []).filter(l => l.variance !== 0).map(l => (
                  <li key={l.id}>
                    <strong>{l.product?.sku}:</strong> System had {l.system_stock}, Counted {l.counted_stock} (Adjustment: {l.variance > 0 ? `+${l.variance}` : l.variance})
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveReconciliation}
                className="btn-primary py-2 text-xs font-bold"
              >
                Post Ledger Adjustments
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
