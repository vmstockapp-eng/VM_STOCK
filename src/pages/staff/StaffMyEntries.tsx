import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Calendar, Warehouse as WarehouseIcon, ChevronRight,
  Clock, CheckCircle2, AlertCircle, Edit3, Eye, Filter, Truck, Gauge,
  X, ArrowDownLeft, Trash2, ArrowLeft, Plus
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getDailyReports, getDeliveries, updateDeliveryReturnKM,
  getInwardEntries, getAllStaffDrafts, deleteInwardDraft,
  deleteDeliveryDraft, deletePhysicalCountDraft
} from '../../lib/dataService'
import { formatDate, getStatusColor, formatNumber } from '../../lib/utils'
import type { ReportStatus, DailyStockReport, OutwardDelivery, InwardStockEntry } from '../../types'

export default function StaffMyEntries() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'deliveries' | 'inward' | 'drafts' | 'reports'>('deliveries')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<'all' | 'awaiting_return' | 'completed'>('all')
  const [deliveriesVer, setDeliveriesVer] = useState(0)
  const [draftsVer, setDraftsVer] = useState(0)

  // Return KM Modal State for Staff
  const [returnModalDelivery, setReturnModalDelivery] = useState<OutwardDelivery | null>(null)
  const [staffInKm, setStaffInKm] = useState<string>('')
  const [staffReturnNotes, setStaffReturnNotes] = useState<string>('')
  const [isSavingReturn, setIsSavingReturn] = useState(false)

  const reports = useMemo(() => {
    return getDailyReports(profile?.warehouse_id || undefined, profile?.id)
  }, [profile])

  const filteredReports = useMemo(() => {
    if (statusFilter === 'all') return reports
    return reports.filter(r => r.status === statusFilter)
  }, [reports, statusFilter])

  const deliveries = useMemo(() => {
    const list = getDeliveries(profile?.warehouse_id ? { warehouseId: profile.warehouse_id } : undefined)
    return list.filter(d => d.status !== 'draft')
  }, [profile, deliveriesVer])

  const filteredDeliveries = useMemo(() => {
    if (deliveryStatusFilter === 'all') return deliveries
    return deliveries.filter(d => d.status === deliveryStatusFilter)
  }, [deliveries, deliveryStatusFilter])

  const inwardEntries = useMemo(() => {
    const list = getInwardEntries(profile?.warehouse_id || undefined)
    return list.filter(e => e.status === 'saved')
  }, [profile])

  const staffDrafts = useMemo(() => {
    return getAllStaffDrafts(profile?.warehouse_id || undefined, profile?.id)
  }, [profile, draftsVer])

  const handleOpenStaffReturn = (del: OutwardDelivery) => {
    setReturnModalDelivery(del)
    setStaffInKm(del.vehicle_in_km ? String(del.vehicle_in_km) : '')
    setStaffReturnNotes(del.return_notes || '')
  }

  const handleSaveStaffReturn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnModalDelivery) return

    const numInKm = Number(staffInKm)
    if (!numInKm || isNaN(numInKm)) {
      toast('error', 'Invalid Reading', 'Please enter a valid numeric Vehicle In KM.')
      return
    }

    if (numInKm < returnModalDelivery.vehicle_out_km) {
      toast('error', 'Odometer Error', `Vehicle In KM (${numInKm}) cannot be less than Vehicle Out KM (${returnModalDelivery.vehicle_out_km}).`)
      return
    }

    setIsSavingReturn(true)
    try {
      const updated = updateDeliveryReturnKM(
        returnModalDelivery.id,
        numInKm,
        staffReturnNotes.trim() || undefined,
        profile || undefined
      )
      setDeliveriesVer(v => v + 1)
      setReturnModalDelivery(null)
      toast(
        'success',
        'Vehicle Return Saved',
        `Vehicle ${updated.vehicle_registration_number} return logged. Distance: ${updated.distance_travelled} km.`
      )
    } catch (err: any) {
      toast('error', 'Update Failed', err.message || 'Error occurred while saving return.')
    } finally {
      setIsSavingReturn(false)
    }
  }

  const handleDeleteDraft = (e: React.MouseEvent, draft: { type: string; reference: string }) => {
    e.stopPropagation()
    if (draft.type === 'inward') deleteInwardDraft(draft.reference)
    else if (draft.type === 'outward') deleteDeliveryDraft(draft.reference)
    else deletePhysicalCountDraft(draft.reference)

    setDraftsVer(v => v + 1)
    toast('info', 'Draft Deleted', `Draft ${draft.reference} deleted.`)
  }

  return (
    <StaffLayout title="Stock Movement History & Registers">
      <div className="space-y-4 max-w-2xl mx-auto pb-12">
        {/* Top View Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#F4F7FA] rounded-2xl border border-[#DCE5EB]">
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'deliveries'
                ? 'bg-white text-[#102C42] shadow-sm'
                : 'text-[#72869A] hover:text-[#102C42]'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-[#0D827D]" />
            <span className="truncate">Outward ({deliveries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inward')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'inward'
                ? 'bg-white text-[#102C42] shadow-sm'
                : 'text-[#72869A] hover:text-[#102C42]'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#0D827D]" />
            <span className="truncate">Inward ({inwardEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('drafts')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'drafts'
                ? 'bg-white text-[#102C42] shadow-sm'
                : 'text-[#72869A] hover:text-[#102C42]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="truncate">Drafts ({staffDrafts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'reports'
                ? 'bg-white text-[#102C42] shadow-sm'
                : 'text-[#72869A] hover:text-[#102C42]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#0D827D]" />
            <span className="truncate">Reports ({reports.length})</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: OUTWARD DELIVERIES & VEHICLE RETURN LOGS              */}
        {/* ============================================================ */}
        {activeTab === 'deliveries' && (
          <div className="space-y-3">
            {/* Delivery Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setDeliveryStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  deliveryStatusFilter === 'all'
                    ? 'bg-[#102C42] text-white shadow-xs'
                    : 'bg-white text-[#72869A] border border-[#DCE5EB] hover:bg-[#F4F7FA]'
                }`}
              >
                All Dispatches ({deliveries.length})
              </button>
              <button
                onClick={() => setDeliveryStatusFilter('awaiting_return')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  deliveryStatusFilter === 'awaiting_return'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                ⏳ Awaiting Return ({deliveries.filter(d => d.status === 'awaiting_return').length})
              </button>
              <button
                onClick={() => setDeliveryStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  deliveryStatusFilter === 'completed'
                    ? 'bg-[#16845B] text-white shadow-xs'
                    : 'bg-white text-[#16845B] border border-green-200 hover:bg-green-50'
                }`}
              >
                ✓ Returned ({deliveries.filter(d => d.status === 'completed').length})
              </button>
            </div>

            {/* Deliveries List */}
            <div className="space-y-2.5">
              {filteredDeliveries.length === 0 ? (
                <div className="card p-8 text-center bg-white rounded-2xl border border-[#DCE5EB]">
                  <Truck className="w-8 h-8 text-[#72869A] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-[#102C42]">No deliveries found</p>
                  <p className="text-xs text-[#72869A] mt-0.5">No dispatches match the selected filter.</p>
                  <button
                    onClick={() => navigate('/staff/outward')}
                    className="btn-primary mt-4 py-2 px-4 text-xs font-bold"
                  >
                    Create New Outward Delivery
                  </button>
                </div>
              ) : (
                filteredDeliveries.map(del => {
                  const isAwaiting = del.status === 'awaiting_return' || del.vehicle_in_km === null

                  return (
                    <div
                      key={del.id}
                      className="card p-4 bg-white rounded-2xl border border-[#DCE5EB] shadow-xs hover:border-[#0D827D] transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between pb-2 border-b border-[#DCE5EB]/60">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                              {del.delivery_ref}
                            </span>
                            <span className="font-bold text-xs text-[#102C42]">{del.customer_name}</span>
                            <span className="text-xs text-[#72869A]">({del.city})</span>
                          </div>
                          <p className="text-[11px] text-[#72869A] mt-0.5">
                            Dispatched on {formatDate(del.date, 'dd MMM yyyy')} • D.O. {del.do_number}
                          </p>
                        </div>

                        {isAwaiting ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Awaiting Return
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-green-50 text-[#16845B] border border-green-200">
                            <CheckCircle2 className="w-3 h-3" /> Vehicle Returned
                          </span>
                        )}
                      </div>

                      {/* Items Summary */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#72869A]">
                          <span>Materials Loaded ({del.items.length} sizes)</span>
                          <span className="font-bold text-[#102C42]">
                            {formatNumber(del.items.reduce((s, i) => s + i.quantity, 0))} total units
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {del.items.map(it => (
                            <span
                              key={it.id}
                              className="text-[11px] font-medium bg-[#F4F7FA] text-[#102C42] px-2 py-0.5 rounded border border-[#DCE5EB]"
                            >
                              {it.size_label ? `${it.size_label}mm: ` : ''}<strong>{it.quantity}</strong> {it.unit}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Logistics & Vehicle Tracking */}
                      <div className="bg-[#F4F7FA]/70 rounded-xl p-3 border border-[#DCE5EB] space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-[#72869A] block uppercase font-semibold">Vehicle</span>
                            <span className="font-mono font-bold text-[#102C42]">{del.vehicle_registration_number}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#72869A] block uppercase font-semibold">Driver</span>
                            <span className="font-medium text-[#102C42]">{del.driver_name}</span>
                          </div>
                        </div>

                        {/* Odometer Details */}
                        <div className="pt-2 border-t border-[#DCE5EB] flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4 text-[#0D827D]" />
                            <span className="font-mono text-xs">
                              OUT: <strong>{del.vehicle_out_km} KM</strong>
                            </span>
                            {del.vehicle_in_km ? (
                              <span className="font-mono text-xs">
                                • IN: <strong>{del.vehicle_in_km} KM</strong>
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-semibold">• Return Pending</span>
                            )}
                          </div>

                          {del.distance_travelled ? (
                            <span className="font-bold text-xs text-[#0D827D] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {del.distance_travelled} KM Travelled
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Return KM Action Button */}
                      {isAwaiting && (
                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={() => handleOpenStaffReturn(del)}
                            className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                          >
                            <Gauge className="w-3.5 h-3.5" />
                            <span>Enter Return KM (Godown Staff)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: INWARD GOODS RECEIPTS                                 */}
        {/* ============================================================ */}
        {activeTab === 'inward' && (
          <div className="space-y-2.5">
            {inwardEntries.length === 0 ? (
              <div className="card p-8 text-center bg-white rounded-2xl border border-[#DCE5EB]">
                <ArrowDownLeft className="w-8 h-8 text-[#72869A] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-[#102C42]">No inward entries yet</p>
                <p className="text-xs text-[#72869A] mt-0.5">Record factory arrivals using the Inward Stock Entry form.</p>
                <button
                  onClick={() => navigate('/staff/inward')}
                  className="btn-primary mt-4 py-2 px-4 text-xs font-bold"
                >
                  Record New Inward Goods
                </button>
              </div>
            ) : (
              inwardEntries.map(entry => {
                const totalUnits = entry.lines.reduce((s, l) => s + (l.quantity || 0), 0)
                return (
                  <div
                    key={entry.id}
                    className="card p-4 bg-white rounded-2xl border border-[#DCE5EB] shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between pb-2 border-b border-[#DCE5EB]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#0D827D] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {entry.reference_no}
                          </span>
                          <span className="font-bold text-xs text-[#102C42]">{entry.supplier_name}</span>
                        </div>
                        <p className="text-[11px] text-[#72869A] mt-0.5">
                          Received on {formatDate(entry.entry_date, 'dd MMM yyyy')} • Challan: {entry.challan_no}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold bg-green-50 text-[#16845B] border border-green-200 px-2.5 py-0.5 rounded-full">
                        Saved in Ledger
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {entry.lines.filter(l => l.quantity > 0).map(line => (
                        <span
                          key={line.id}
                          className="text-[11px] bg-[#F4F7FA] text-[#102C42] px-2 py-0.5 rounded border border-[#DCE5EB]"
                        >
                          {line.product?.name || line.product_id}: <strong>{line.quantity}</strong> {line.unit}
                        </span>
                      ))}
                    </div>

                    <div className="text-right text-[11px] text-[#72869A]">
                      Total: <strong className="text-[#16845B]">{formatNumber(totalUnits)}</strong> units
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: UNFINISHED DRAFTS (INWARD, OUTWARD, MANUAL COUNT)     */}
        {/* ============================================================ */}
        {activeTab === 'drafts' && (
          <div className="space-y-2.5">
            {staffDrafts.length === 0 ? (
              <div className="card p-8 text-center bg-white rounded-2xl border border-[#DCE5EB]">
                <Clock className="w-8 h-8 text-[#72869A] mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-[#102C42]">No pending drafts</p>
                <p className="text-xs text-[#72869A] mt-0.5">All stock operations are either submitted or no drafts have been created.</p>
              </div>
            ) : (
              staffDrafts.map(d => (
                <div
                  key={d.id}
                  onClick={() => navigate(d.route)}
                  className="card p-4 bg-white rounded-2xl border border-amber-200 hover:border-[#0D827D] shadow-xs cursor-pointer transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0D827D] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {d.reference}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        {d.typeLabel}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#102C42] mt-1 truncate">{d.title}</h4>
                    <p className="text-[11px] text-[#72869A] truncate">{d.subtitle}</p>
                    <p className="text-[10px] text-[#72869A] mt-1">
                      Last edited: {formatDate(d.updatedAt, 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDraft(e, d)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-[#0D827D] bg-teal-50 px-2.5 py-1.5 rounded-xl border border-teal-200 flex items-center gap-1">
                      Resume <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: DAILY STOCK REPORTS                                   */}
        {/* ============================================================ */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['all', 'draft', 'submitted', 'posted'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-[#102C42] text-white shadow-xs'
                      : 'bg-white text-[#72869A] border border-[#DCE5EB] hover:bg-[#F4F7FA]'
                  }`}
                >
                  {st} ({reports.filter(r => st === 'all' || r.status === st).length})
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredReports.length === 0 ? (
                <div className="card p-6 text-center bg-white rounded-2xl border border-[#DCE5EB] text-xs text-[#72869A]">
                  No daily reports found.
                </div>
              ) : (
                filteredReports.map(rep => (
                  <div key={rep.id} className="card p-3.5 bg-white rounded-2xl border border-[#DCE5EB] shadow-xs flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#102C42]">{rep.report_date}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-[#102C42]">
                          {rep.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#72869A] mt-0.5">
                        {rep.lines?.length || 0} Products Recorded • {rep.warehouse?.name}
                      </p>
                    </div>

                    {rep.status === 'draft' && (
                      <button
                        onClick={() => navigate(`/staff/stock-entry?draftId=${rep.id}`)}
                        className="text-xs font-bold text-[#0D827D] bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200"
                      >
                        Edit Draft
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Return KM Modal for Staff */}
        {returnModalDelivery && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl border border-[#DCE5EB] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EB]">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[#0D827D]" />
                  <h3 className="text-sm font-bold text-[#102C42]">Vehicle Return Odometer</h3>
                </div>
                <button
                  onClick={() => setReturnModalDelivery(null)}
                  className="text-[#72869A] hover:text-[#102C42] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-[#E7F3F1] rounded-xl border border-[#0D827D]/30 text-xs text-[#102C42] space-y-1">
                <p><strong>Delivery:</strong> {returnModalDelivery.delivery_ref} ({returnModalDelivery.customer_name})</p>
                <p><strong>Vehicle:</strong> {returnModalDelivery.vehicle_registration_number} • Driver: {returnModalDelivery.driver_name}</p>
                <p><strong>OUT KM (at dispatch):</strong> <span className="font-mono font-bold">{returnModalDelivery.vehicle_out_km} KM</span></p>
              </div>

              <form onSubmit={handleSaveStaffReturn} className="space-y-3">
                <div>
                  <label className="label">Vehicle IN KM (Upon Return) *</label>
                  <input
                    type="number"
                    min={returnModalDelivery.vehicle_out_km}
                    required
                    autoFocus
                    placeholder={`Must be ≥ ${returnModalDelivery.vehicle_out_km}`}
                    value={staffInKm}
                    onChange={e => setStaffInKm(e.target.value)}
                    className="input-field font-mono font-extrabold text-base"
                  />
                  {Number(staffInKm) > returnModalDelivery.vehicle_out_km && (
                    <p className="text-[11px] text-[#0D827D] font-bold mt-1">
                      Calculated Distance: {Number(staffInKm) - returnModalDelivery.vehicle_out_km} KM
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Return Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Returned on time, vehicle parked in Bay 3"
                    value={staffReturnNotes}
                    onChange={e => setStaffReturnNotes(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReturnModalDelivery(null)}
                    className="btn-secondary flex-1 py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingReturn}
                    className="btn-primary flex-1 py-2 text-xs font-bold"
                  >
                    {isSavingReturn ? 'Saving...' : 'Save Return KM'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
