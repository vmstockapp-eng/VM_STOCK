import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft, ArrowUpRight, ClipboardCheck, History,
  Calendar, Warehouse as WarehouseIcon, Package, Truck,
  ChevronRight, Clock, CheckCircle2, AlertCircle, FileText,
  Gauge, Plus, ArrowLeft, RefreshCw, X
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getInwardEntries, getDeliveries, getWarehouses,
  getAllStaffDrafts, updateDeliveryReturnKM
} from '../../lib/dataService'
import type { OutwardDelivery, InwardStockEntry } from '../../types'
import { formatDate, formatNumber } from '../../lib/utils'

export default function StaffStockHub() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const warehouses = useMemo(() => getWarehouses(), [])
  const defaultWhId = profile?.warehouse_id || warehouses[1]?.id || 'w-2'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(defaultWhId)
  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0]

  const [deliveriesVersion, setDeliveriesVersion] = useState(0)

  // Return KM Modal State
  const [returnModalDelivery, setReturnModalDelivery] = useState<OutwardDelivery | null>(null)
  const [returnInKm, setReturnInKm] = useState<string>('')
  const [returnNotes, setReturnNotes] = useState<string>('')
  const [isSavingReturn, setIsSavingReturn] = useState(false)

  // Today's date string YYYY-MM-DD
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // All Inward Entries for this warehouse
  const allInward = useMemo(() => {
    return getInwardEntries(selectedWarehouseId)
  }, [selectedWarehouseId])

  // Today's Inward Entries
  const todaysInward = useMemo(() => {
    return allInward.filter(e => e.entry_date === todayDateStr && e.status === 'saved')
  }, [allInward, todayDateStr])

  // All Deliveries for this warehouse
  const allDeliveries = useMemo(() => {
    return getDeliveries({ warehouseId: selectedWarehouseId })
  }, [selectedWarehouseId, deliveriesVersion])

  // Today's Completed or Active Deliveries
  const todaysDeliveries = useMemo(() => {
    return allDeliveries.filter(d => d.date === todayDateStr && d.status !== 'draft')
  }, [allDeliveries, todayDateStr])

  // Deliveries awaiting vehicle return KM
  const pendingReturnDeliveries = useMemo(() => {
    return allDeliveries.filter(d => d.status === 'awaiting_return' || (d.status !== 'draft' && d.vehicle_in_km === null))
  }, [allDeliveries])

  // Pending Drafts across all operations
  const drafts = useMemo(() => {
    return getAllStaffDrafts(selectedWarehouseId, profile?.id)
  }, [selectedWarehouseId, profile?.id])

  const handleOpenReturnModal = (delivery: OutwardDelivery) => {
    setReturnModalDelivery(delivery)
    setReturnInKm(delivery.vehicle_in_km ? String(delivery.vehicle_in_km) : '')
    setReturnNotes(delivery.return_notes || '')
  }

  const handleSaveReturnKm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnModalDelivery) return

    const numInKm = Number(returnInKm)
    if (!numInKm || isNaN(numInKm)) {
      toast('error', 'Invalid Reading', 'Please enter a valid numeric Vehicle In KM.')
      return
    }

    if (numInKm < returnModalDelivery.vehicle_out_km) {
      toast(
        'error',
        'Odometer Error',
        `Vehicle In KM (${numInKm}) cannot be less than Vehicle Out KM (${returnModalDelivery.vehicle_out_km}).`
      )
      return
    }

    setIsSavingReturn(true)
    try {
      const updated = updateDeliveryReturnKM(
        returnModalDelivery.id,
        numInKm,
        returnNotes.trim() || undefined,
        profile || undefined
      )
      setDeliveriesVersion(v => v + 1)
      setReturnModalDelivery(null)
      toast(
        'success',
        'Vehicle Return Recorded',
        `Vehicle ${updated.vehicle_registration_number} logged! Distance travelled: ${updated.distance_travelled} km.`
      )
    } catch (err: any) {
      toast('error', 'Update Failed', err.message || 'Error occurred while saving return.')
    } finally {
      setIsSavingReturn(false)
    }
  }

  return (
    <StaffLayout title="Godown Stock Operations">
      <div className="space-y-4 pb-12 max-w-2xl mx-auto">
        {/* Godown Selector & Date Banner */}
        <div className="card p-3.5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#0D827D] text-white flex items-center justify-center shrink-0">
                <WarehouseIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] font-bold text-[#72869A] uppercase tracking-wider block">
                  Active Godown
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  className="font-bold text-xs text-[#102C42] bg-transparent border-0 p-0 focus:ring-0 cursor-pointer truncate"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-semibold text-[#72869A] block">Today's Date</span>
              <span className="text-xs font-bold text-[#102C42]">{formatDate(todayDateStr)}</span>
            </div>
          </div>
        </div>

        {/* Pending Drafts Banner (If any) */}
        {drafts.length > 0 && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl shadow-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">
                  {drafts.length} Unfinished Draft{drafts.length > 1 ? 's' : ''} Saved
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                Not Affecting Stock
              </span>
            </div>

            <div className="divide-y divide-amber-200/60">
              {drafts.slice(0, 2).map(d => (
                <div
                  key={d.id}
                  onClick={() => navigate(d.route)}
                  className="py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-amber-100/50 rounded-lg px-1 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#102C42] truncate">
                      {d.typeLabel}: {d.title}
                    </p>
                    <p className="text-[10px] text-amber-800 truncate">{d.subtitle}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#0D827D] hover:underline shrink-0 flex items-center gap-0.5">
                    Resume <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 1: Main Staff Stock Operations Header */}
        <div>
          <h2 className="text-xs font-extrabold text-[#72869A] uppercase tracking-wider mb-2.5 px-1">
            MAIN STAFF STOCK OPERATIONS
          </h2>

          <div className="space-y-2.5">
            {/* 1. Inward Stock Entry */}
            <div
              onClick={() => navigate('/staff/inward')}
              className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D] hover:shadow-md cursor-pointer transition-all flex items-center gap-3.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#E7F3F1] text-[#0D827D] flex items-center justify-center shrink-0 border border-teal-200/60">
                <ArrowDownLeft className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#102C42]">
                  1. Inward Stock Entry
                </h3>
                <p className="text-xs text-[#72869A] mt-0.5 line-clamp-1">
                  Record factory arrivals & received pipes, fittings, tanks
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>

            {/* 2. Outward Stock Entry */}
            <div
              onClick={() => navigate('/staff/outward')}
              className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D] hover:shadow-md cursor-pointer transition-all flex items-center gap-3.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#102C42] flex items-center justify-center shrink-0 border border-blue-200/60">
                <ArrowUpRight className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#102C42]">
                  2. Outward Stock Entry
                </h3>
                <p className="text-xs text-[#72869A] mt-0.5 line-clamp-1">
                  Record customer delivery dispatches, vehicle & KM readings
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>

            {/* 3. Manual Stock Entry */}
            <div
              onClick={() => navigate('/staff/manual-entry')}
              className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D] hover:shadow-md cursor-pointer transition-all flex items-center gap-3.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#D97706] flex items-center justify-center shrink-0 border border-amber-200/60">
                <ClipboardCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#102C42]">
                  3. Manual Stock Entry
                </h3>
                <p className="text-xs text-[#72869A] mt-0.5 line-clamp-1">
                  Physical count verification, spot checks & stock adjustments
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>

            {/* 4. Stock History */}
            <div
              onClick={() => navigate('/staff/my-entries')}
              className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D] hover:shadow-md cursor-pointer transition-all flex items-center gap-3.5 active:scale-[0.99]"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#102C42] flex items-center justify-center shrink-0 border border-slate-200">
                <History className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-[#102C42]">
                  4. Stock History & Registers
                </h3>
                <p className="text-xs text-[#72869A] mt-0.5 line-clamp-1">
                  All past inward receipts, customer dispatches & reports
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Section 2: Today's Entries (Inward Goods Received Today) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold text-[#72869A] uppercase tracking-wider flex items-center gap-1.5">
              <span>5. TODAY'S INWARD ENTRIES</span>
              <span className="text-[10px] font-bold bg-[#E7F3F1] text-[#0D827D] px-2 py-0.2 rounded-full">
                {todaysInward.length} Received
              </span>
            </h2>
            <button
              onClick={() => navigate('/staff/inward')}
              className="text-[11px] font-bold text-[#0D827D] hover:underline flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> New Inward
            </button>
          </div>

          {todaysInward.length === 0 ? (
            <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl text-center text-xs text-[#72869A]">
              <Package className="w-6 h-6 mx-auto mb-1 text-slate-300" />
              <span>
                No factory goods received yet today at {activeWarehouse?.code || 'your assigned godown'}.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysInward.map(entry => {
                const totalUnits = entry.lines.reduce((s, l) => s + (l.quantity || 0), 0)
                return (
                  <div
                    key={entry.id}
                    className="card p-3.5 border border-[#DCE5EB] bg-white rounded-2xl shadow-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#0D827D]">{entry.reference_no}</span>
                        <h4 className="text-xs font-bold text-[#102C42]">{entry.supplier_name}</h4>
                      </div>
                      <span className="text-[10px] font-bold bg-green-50 text-[#16845B] border border-green-200 px-2 py-0.5 rounded-full">
                        Stock Added
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#72869A] pt-1 border-t border-[#DCE5EB]">
                      <span>Challan: <strong className="text-[#102C42]">{entry.challan_no}</strong></span>
                      <span>Total: <strong className="text-[#16845B]">{formatNumber(totalUnits)}</strong> units ({entry.lines.length} items)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Section 3: Today's Completed Deliveries & Vehicle Return Updates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold text-[#72869A] uppercase tracking-wider flex items-center gap-1.5">
              <span>6. TODAY'S DELIVERIES & VEHICLE KM</span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.2 rounded-full border border-blue-200">
                {todaysDeliveries.length} Dispatched
              </span>
            </h2>
            <button
              onClick={() => navigate('/staff/outward')}
              className="text-[11px] font-bold text-[#0D827D] hover:underline flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> New Outward
            </button>
          </div>

          {todaysDeliveries.length === 0 ? (
            <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl text-center text-xs text-[#72869A]">
              <Truck className="w-6 h-6 mx-auto mb-1 text-slate-300" />
            <span>
              No customer dispatches logged yet today at {activeWarehouse?.code || 'your assigned godown'}.
            </span>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysDeliveries.map(del => {
                const isPendingReturn = del.status === 'awaiting_return' || del.vehicle_in_km === null
                return (
                  <div
                    key={del.id}
                    className={`card p-3.5 border rounded-2xl shadow-xs space-y-2 transition-all ${
                      isPendingReturn ? 'border-amber-300 bg-amber-50/40' : 'border-[#DCE5EB] bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[#0D827D]">{del.delivery_ref}</span>
                          <span className="text-[10px] text-[#72869A]">D.O. {del.do_number}</span>
                        </div>
                        <h4 className="text-xs font-bold text-[#102C42] mt-0.5">{del.customer_name} ({del.city})</h4>
                      </div>

                      {isPendingReturn ? (
                        <button
                          onClick={() => handleOpenReturnModal(del)}
                          className="text-[10px] font-bold bg-[#0D827D] text-white px-2.5 py-1 rounded-xl shadow-xs hover:bg-[#09635f] flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          <Gauge className="w-3 h-3" />
                          <span>Enter Return KM</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold bg-green-50 text-[#16845B] border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}
                    </div>

                    {/* Logistics details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-white rounded-xl border border-[#DCE5EB] text-[11px]">
                      <div>
                        <span className="text-[10px] text-[#72869A] block">Vehicle</span>
                        <strong className="text-[#102C42] font-mono">{del.vehicle_registration_number}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#72869A] block">Driver</span>
                        <span className="text-[#102C42] font-medium truncate block">{del.driver_name}</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-[#72869A] block">Odometer Track</span>
                        <span className="text-[#102C42] font-mono text-[11px]">
                          Out: <strong>{del.vehicle_out_km}</strong>
                          {del.vehicle_in_km ? (
                            <> • In: <strong>{del.vehicle_in_km}</strong> (<strong className="text-[#0D827D]">{del.distance_travelled} km</strong>)</>
                          ) : (
                            <span className="text-amber-600 font-semibold"> • In transit</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Vehicle Return KM Modal for Staff */}
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

              <form onSubmit={handleSaveReturnKm} className="space-y-3">
                <div>
                  <label className="label">Vehicle IN KM (Upon Return) *</label>
                  <input
                    type="number"
                    min={returnModalDelivery.vehicle_out_km}
                    required
                    autoFocus
                    placeholder={`Must be ≥ ${returnModalDelivery.vehicle_out_km}`}
                    value={returnInKm}
                    onChange={e => setReturnInKm(e.target.value)}
                    className="input-field font-mono font-extrabold text-base"
                  />
                  {Number(returnInKm) > returnModalDelivery.vehicle_out_km && (
                    <p className="text-[11px] text-[#0D827D] font-bold mt-1">
                      Calculated Distance: {Number(returnInKm) - returnModalDelivery.vehicle_out_km} KM
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Return Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Returned on time, fuel topped up"
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
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
