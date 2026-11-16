import React, { useState, useMemo } from 'react'
import {
  CheckSquare, CheckCircle2, XCircle, Clock, AlertTriangle, Eye,
  Warehouse as WarehouseIcon, User, Calendar, MessageSquare
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import { getApprovalRequests, actionApproval, getDailyReportById } from '../../lib/dataService'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import { formatDate, formatDateTime, getStatusColor, formatNumber } from '../../lib/utils'
import type { ApprovalRequest, DailyStockReport } from '../../types'

export default function AdminApprovals() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [approvalsList, setApprovalsList] = useState<ApprovalRequest[]>(() => getApprovalRequests())
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')

  // Modals
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'correction_requested'>('approve')
  const [reviewNotes, setReviewNotes] = useState('')
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [viewingReportDetails, setViewingReportDetails] = useState<DailyStockReport | null>(null)

  const pendingList = useMemo(() => approvalsList.filter(a => a.status === 'pending'), [approvalsList])
  const approvedList = useMemo(() => approvalsList.filter(a => a.status === 'approved'), [approvalsList])
  const rejectedList = useMemo(() => approvalsList.filter(a => a.status === 'rejected'), [approvalsList])

  const displayedList = useMemo(() => {
    if (activeTab === 'pending') return pendingList
    if (activeTab === 'approved') return approvedList
    return rejectedList
  }, [activeTab, pendingList, approvedList, rejectedList])

  const openActionModal = (req: ApprovalRequest, type: 'approve' | 'reject') => {
    setSelectedApproval(req)
    setActionType(type)
    setReviewNotes('')
    setActionModalOpen(true)
  }

  const openDetailsModal = (req: ApprovalRequest) => {
    setSelectedApproval(req)
    if (req.request_type === 'stock_report') {
      const rep = getDailyReportById(req.entity_id)
      setViewingReportDetails(rep || null)
    } else {
      setViewingReportDetails(null)
    }
    setDetailsModalOpen(true)
  }

  const handleExecuteAction = () => {
    if (!profile || !selectedApproval) return
    if (actionType === 'reject' && !reviewNotes.trim()) {
      toast('error', 'Reason Mandatory', 'Please provide a clear rejection reason for the staff member.')
      return
    }

    try {
      actionApproval(selectedApproval.id, actionType, profile, reviewNotes)
      setApprovalsList(getApprovalRequests())
      setActionModalOpen(false)
      toast(
        actionType === 'approve' ? 'success' : 'info',
        actionType === 'approve' ? 'Request Approved' : 'Request Rejected',
        `Transaction ${selectedApproval.reference_no} updated successfully.`
      )
    } catch (err: any) {
      toast('error', 'Action Failed', err.message)
    }
  }

  return (
    <AdminLayout title="Approval Management Queue">
      <div className="space-y-4">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveTab('pending')}
            className={`card p-4 text-left border rounded-2xl transition-all ${
              activeTab === 'pending'
                ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300 shadow-card'
                : 'border-brand-border bg-white hover:border-brand-border/80'
            }`}
          >
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Review</span>
              <Clock className="w-4 h-4 text-brand-warning" />
            </div>
            <p className="text-2xl font-bold text-brand-warning">{pendingList.length}</p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Awaiting verification</p>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`card p-4 text-left border rounded-2xl transition-all ${
              activeTab === 'approved'
                ? 'border-green-400 bg-green-50/40 ring-1 ring-green-300 shadow-card'
                : 'border-brand-border bg-white hover:border-brand-border/80'
            }`}
          >
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Approved & Posted</span>
              <CheckCircle2 className="w-4 h-4 text-brand-success" />
            </div>
            <p className="text-2xl font-bold text-brand-success">{approvedList.length}</p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Posted to stock ledger</p>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`card p-4 text-left border rounded-2xl transition-all ${
              activeTab === 'rejected'
                ? 'border-red-400 bg-red-50/40 ring-1 ring-red-300 shadow-card'
                : 'border-brand-border bg-white hover:border-brand-border/80'
            }`}
          >
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Rejected Requests</span>
              <XCircle className="w-4 h-4 text-brand-error" />
            </div>
            <p className="text-2xl font-bold text-brand-error">{rejectedList.length}</p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Returned with correction notes</p>
          </button>
        </div>

        {/* Approvals Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="p-4 border-b border-brand-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-navy-DEFAULT uppercase tracking-wider">
              {activeTab.toUpperCase()} Requests ({displayedList.length})
            </h3>
            <span className="text-[11px] text-brand-textSecondary">
              Reviewer: <strong>{profile?.full_name}</strong> ({profile?.role})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-3 px-4">Ref / Type</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Godown Location</th>
                  <th className="py-3 px-4">Summary & Reason</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {displayedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-brand-textSecondary">
                      No {activeTab} requests in this queue.
                    </td>
                  </tr>
                ) : (
                  displayedList.map(req => (
                    <tr key={req.id} className="hover:bg-brand-bg/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-navy-DEFAULT block">{req.reference_no}</span>
                        <span className="text-[10px] uppercase font-semibold text-teal-DEFAULT">
                          {req.request_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-brand-textPrimary">
                        {req.creator_name || 'Staff Member'}
                      </td>
                      <td className="py-3 px-4 text-brand-textSecondary">
                        {req.warehouse?.name || 'Central'}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-bold text-navy-DEFAULT block truncate">{req.summary}</span>
                        <span className="text-[11px] text-brand-textSecondary block truncate">
                          {req.reason || 'Routine inventory transaction'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-brand-textSecondary whitespace-nowrap">
                        {formatDateTime(req.created_at)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetailsModal(req)}
                            className="p-1 text-brand-textSecondary hover:text-navy-DEFAULT rounded hover:bg-brand-bg"
                            title="View Full Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openActionModal(req, 'approve')}
                                className="btn-primary py-1 px-2.5 text-[11px] font-bold"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openActionModal(req, 'reject')}
                                className="btn-secondary py-1 px-2.5 text-[11px] font-bold text-brand-error border-red-200 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Approve / Reject Action */}
        <Modal
          open={actionModalOpen}
          onClose={() => setActionModalOpen(false)}
          title={actionType === 'approve' ? 'Confirm Approval & Post to Ledger' : 'Reject Submission'}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-brand-bg rounded-xl border border-brand-border space-y-1">
              <p className="font-bold text-navy-DEFAULT">{selectedApproval?.summary}</p>
              <p className="text-brand-textSecondary">
                Ref: {selectedApproval?.reference_no} • Location: {selectedApproval?.warehouse?.name}
              </p>
            </div>

            {actionType === 'approve' ? (
              <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-brand-success space-y-1">
                <strong>Accounting Rule:</strong> Approving will immediately post the movements and update the official godown stock balance atomically.
              </div>
            ) : (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-brand-error space-y-1">
                <strong>Rejection Rule:</strong> Please specify the exact discrepancy so the staff member can correct the draft and resubmit.
              </div>
            )}

            <div>
              <label className="label">
                {actionType === 'approve' ? 'Reviewer Notes (Optional)' : 'Rejection Reason *'}
              </label>
              <textarea
                rows={3}
                required={actionType === 'reject'}
                placeholder={actionType === 'approve' ? 'Approved for dispatch...' : 'e.g. Inward count for PVC 63mm does not match physical challan copy...'}
                className="input-field text-xs resize-none"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                className={actionType === 'approve' ? 'btn-primary py-2 text-xs font-bold' : 'btn-danger py-2 text-xs font-bold'}
              >
                {actionType === 'approve' ? 'Post & Approve' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Modal: View Details */}
        <Modal
          open={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={`Request Details: ${selectedApproval?.reference_no}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-brand-bg rounded-xl border border-brand-border">
              <div>
                <span className="text-brand-textSecondary block text-[10px] uppercase">Submitted By</span>
                <span className="font-bold text-navy-DEFAULT">{selectedApproval?.creator_name}</span>
              </div>
              <div>
                <span className="text-brand-textSecondary block text-[10px] uppercase">Warehouse Location</span>
                <span className="font-bold text-navy-DEFAULT">{selectedApproval?.warehouse?.name}</span>
              </div>
            </div>

            {viewingReportDetails && viewingReportDetails.lines && (
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-navy-DEFAULT mb-2">
                  Line Items in Daily Stock Report
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {viewingReportDetails.lines.map(line => (
                    <div key={line.id} className="p-2.5 rounded-xl border border-brand-border bg-white text-xs space-y-1">
                      <p className="font-bold text-navy-DEFAULT">{line.product?.name ?? 'Product'}</p>
                      <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-1 border-t border-brand-border/60">
                        <div>
                          <span className="text-brand-textSecondary block text-[9px] uppercase">Opening</span>
                          <span className="font-bold">{formatNumber(line.opening_stock)}</span>
                        </div>
                        <div>
                          <span className="text-brand-success block text-[9px] uppercase">+ Inward</span>
                          <span className="font-bold text-brand-success">+{formatNumber(line.inward_qty)}</span>
                        </div>
                        <div>
                          <span className="text-brand-error block text-[9px] uppercase">− Outward</span>
                          <span className="font-bold text-brand-error">−{formatNumber(line.outward_qty)}</span>
                        </div>
                        <div>
                          <span className="text-teal-DEFAULT block text-[9px] uppercase">= Closing</span>
                          <span className="font-extrabold text-teal-DEFAULT">{formatNumber(line.closing_stock)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
