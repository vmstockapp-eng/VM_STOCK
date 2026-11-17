import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, ArrowDownLeft, ArrowUpRight, ClipboardList,
  Warehouse as WarehouseIcon, Calendar, ChevronRight,
  Layers, CheckCircle2, Clock, Truck, Gauge, X, MapPin, AlertCircle
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getWarehouses, getStockBalances, getMovements, getProducts,
  getDeliveries, updateDeliveryReturnKM
} from '../../lib/dataService'
import { formatDate, formatNumber, getUnitLabel } from '../../lib/utils'
import type { OutwardDelivery } from '../../types'

export default function StaffHome() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const warehouses = useMemo(() => getWarehouses(), [])
  const products = useMemo(() => getProducts(), [])

  // Location selection: default to profile's assigned warehouse, or Godown 1
  const defaultWhId = profile?.warehouse_id || warehouses[1]?.id || 'w-2'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(defaultWhId)

  // Delivery & Return KM State
  const [deliveriesVersion, setDeliveriesVersion] = useState(0)
  const [returnModalDelivery, setReturnModalDelivery] = useState<OutwardDelivery | null>(null)
  const [staffInKm, setStaffInKm] = useState<string>('')
  const [staffReturnNotes, setStaffReturnNotes] = useState<string>('')
  const [isSavingReturn, setIsSavingReturn] = useState(false)

  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0]
  const [todayDateStr] = useState(() => new Date().toISOString().split('T')[0])
  const [todayFormatted] = useState(() => formatDate(new Date(), 'EEEE, dd MMM yyyy'))

  // 1. Opening Stock for Selected Location
  const warehouseBalances = useMemo(() => {
    const allBalances = getStockBalances(selectedWarehouseId)
    return allBalances.filter(b => b.quantity > 0)
  }, [selectedWarehouseId])

  // Count active SKUs and group quantities strictly by unit so units are NEVER added together
  const openingStockUnitSummary = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of warehouseBalances) {
      const u = b.product?.unit || 'piece'
      map[u] = (map[u] || 0) + b.quantity
    }
    return map
  }, [warehouseBalances])

  // 2. Today's Inward Movements for Selected Location
  const todayInwardMovements = useMemo(() => {
    const movements = getMovements({ warehouseId: selectedWarehouseId })
    return movements.filter(m => {
      const isToday = m.created_at.startsWith(todayDateStr)
      const isInwardType = m.movement_type === 'inward' || m.movement_type === 'transfer_in' || m.movement_type === 'return'
      return isToday && isInwardType
    })
  }, [selectedWarehouseId, todayDateStr])

  const todayInwardUnitSummary = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of todayInwardMovements) {
      const u = m.product?.unit || 'piece'
      map[u] = (map[u] || 0) + m.quantity
    }
    return map
  }, [todayInwardMovements])

  // 3. Today's Outward Movements for Selected Location
  const todayOutwardMovements = useMemo(() => {
    const movements = getMovements({ warehouseId: selectedWarehouseId })
    return movements.filter(m => {
      const isToday = m.created_at.startsWith(todayDateStr)
      const isOutwardType = m.movement_type === 'outward' || m.movement_type === 'transfer_out'
      return isToday && isOutwardType
    })
  }, [selectedWarehouseId, todayDateStr])

  const todayOutwardUnitSummary = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of todayOutwardMovements) {
      const u = m.product?.unit || 'piece'
      map[u] = (map[u] || 0) + m.quantity
    }
    return map
  }, [todayOutwardMovements])

  // 4. Active Dispatched Deliveries Awaiting Vehicle Return for this Godown
  const awaitingReturnDeliveries = useMemo(() => {
    void deliveriesVersion
    const list = getDeliveries({ warehouseId: selectedWarehouseId })
    return list.filter(d => d.status === 'awaiting_return' || d.vehicle_in_km === null)
  }, [selectedWarehouseId, deliveriesVersion])

  const handleOpenStaffReturn = (del: OutwardDelivery) => {
    setReturnModalDelivery(del)
    setStaffInKm(del.vehicle_in_km ? String(del.vehicle_in_km) : '')
    setStaffReturnNotes(del.return_notes || '')
  }

  const handleSaveStaffReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnModalDelivery) return

    const numInKm = Number(staffInKm)
    if (!numInKm || isNaN(numInKm)) {
      toast('error', 'Invalid Odometer', 'Please enter a valid numeric Vehicle In KM reading.')
      return
    }

    if (numInKm < returnModalDelivery.vehicle_out_km) {
      toast('error', 'Odometer Error', `Vehicle In KM (${numInKm}) cannot be less than Vehicle Out KM (${returnModalDelivery.vehicle_out_km}).`)
      return
    }

    setIsSavingReturn(true)
    try {
      const updated = await updateDeliveryReturnKM(
        returnModalDelivery.id,
        numInKm,
        staffReturnNotes.trim() || undefined,
        profile || undefined
      )
      setDeliveriesVersion(v => v + 1)
      setReturnModalDelivery(null)
      toast(
        'success',
        'Vehicle Return Recorded',
        `Vehicle ${updated.vehicle_registration_number} return recorded. Distance: ${updated.distance_travelled} km.`
      )
    } catch (err: any) {
      toast('error', 'Save Failed', err.message || 'Failed to update vehicle return reading.')
    } finally {
      setIsSavingReturn(false)
    }
  }

  return (
    <StaffLayout>
      <div className="space-y-4">
        {/* Working Location & Date Header Card */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#DCE5EB]/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#E7F3F1] flex items-center justify-center text-[#0D827D]">
                <WarehouseIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#72869A] uppercase tracking-wider">Working Godown</p>
                <h2 className="text-sm font-bold text-[#102C42]">
                  {activeWarehouse?.name || 'No godown assigned'}
                </h2>
              </div>
            </div>

            {/* Warehouse Switcher if multiple godowns */}
            {warehouses.length > 1 && (
              <select
                className="text-xs font-semibold text-[#102C42] bg-[#F4F7FA] border border-[#DCE5EB] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D827D]"
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.code} ({w.city || 'Yard'})</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#72869A]">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#0D827D]" />
              <span className="font-medium text-[#20384A]">{todayFormatted}</span>
            </div>
            <span className="text-[11px] bg-[#E7F3F1] text-[#0D827D] font-bold px-2 py-0.5 rounded-full">
              Live Stock View
            </span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* EXACTLY 3 PRIMARY SUMMARY CARDS REQUIRED BY SECTION 3       */}
        {/* 1. Opening Stock                                            */}
        {/* 2. Today's Inward                                           */}
        {/* 3. Today's Outward                                          */}
        {/* ============================================================ */}
        <div className="space-y-2.5">
          {/* Card 1: Opening Stock */}
          <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D]/40 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E7F3F1] text-[#0D827D] flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-[#72869A] uppercase tracking-wider block">
                    1. Opening Stock
                  </span>
                  <p className="text-xl font-extrabold text-[#102C42]">
                    {warehouseBalances.length} <span className="text-xs font-semibold text-[#72869A]">Active SKUs</span>
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-bold bg-[#F4F7FA] text-[#20384A] border border-[#DCE5EB] px-2 py-0.5 rounded-full">
                {activeWarehouse?.code || 'N/A'}
              </span>
            </div>

            {/* Clean Unit-Wise Breakdown so incompatible units are never added together */}
            <div className="mt-3 pt-2.5 border-t border-[#DCE5EB]/60">
              <p className="text-[10px] uppercase font-bold text-[#72869A] tracking-wider mb-1.5">
                Unit-Wise Stock Breakdown:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(openingStockUnitSummary).length > 0 ? (
                  Object.entries(openingStockUnitSummary).map(([unit, qty]) => (
                    <span
                      key={unit}
                      className="inline-flex items-center gap-1 text-xs font-bold bg-[#F4F7FA] text-[#102C42] border border-[#DCE5EB] px-2.5 py-1 rounded-xl"
                    >
                      <span>{formatNumber(qty)}</span>
                      <span className="text-[10px] text-[#72869A] font-semibold">{getUnitLabel(unit)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#72869A]">No stock recorded at this yard yet</span>
                )}
              </div>
            </div>
          </div>

          {/* 2-Column Grid for Today's Inward & Today's Outward */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Card 2: Today's Inward */}
            <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#16845B] uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4" /> 2. Today's Inward
                </span>
                <span className="text-[10px] font-semibold bg-green-50 text-[#16845B] px-2 py-0.5 rounded-full border border-green-200">
                  {todayInwardMovements.length} Receipts
                </span>
              </div>

              {Object.keys(todayInwardUnitSummary).length > 0 ? (
                <div className="space-y-1 mt-1">
                  {Object.entries(todayInwardUnitSummary).map(([unit, qty]) => (
                    <p key={unit} className="text-lg font-extrabold text-[#16845B]">
                      +{formatNumber(qty)} <span className="text-xs font-semibold text-[#72869A]">{getUnitLabel(unit)}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <div className="mt-1">
                  <p className="text-lg font-bold text-[#20384A]">0</p>
                  <p className="text-[11px] text-[#72869A]">No receipts logged today</p>
                </div>
              )}
            </div>

            {/* Card 3: Today's Outward */}
            <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#DC4C4C] uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" /> 3. Today's Outward
                </span>
                <span className="text-[10px] font-semibold bg-red-50 text-[#DC4C4C] px-2 py-0.5 rounded-full border border-red-200">
                  {todayOutwardMovements.length} Dispatches
                </span>
              </div>

              {Object.keys(todayOutwardUnitSummary).length > 0 ? (
                <div className="space-y-1 mt-1">
                  {Object.entries(todayOutwardUnitSummary).map(([unit, qty]) => (
                    <p key={unit} className="text-lg font-extrabold text-[#DC4C4C]">
                      −{formatNumber(qty)} <span className="text-xs font-semibold text-[#72869A]">{getUnitLabel(unit)}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <div className="mt-1">
                  <p className="text-lg font-bold text-[#20384A]">0</p>
                  <p className="text-[11px] text-[#72869A]">No dispatches logged today</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DISPATCHED VEHICLES AWAITING RETURN (STAFF RETURN KM ENTRY) */}
        {/* ============================================================ */}
        {awaitingReturnDeliveries.length > 0 && (
          <div className="card p-4 border border-amber-300 bg-amber-50/40 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-xs">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#102C42] uppercase tracking-wider">
                    Dispatches Awaiting Vehicle Return ({awaitingReturnDeliveries.length})
                  </h3>
                  <p className="text-[11px] text-[#72869A]">
                    Godown staff records Return IN KM when vehicle arrives back
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full animate-pulse">
                Return Pending
              </span>
            </div>

            <div className="space-y-2">
              {awaitingReturnDeliveries.map(del => (
                <div
                  key={del.id}
                  className="p-3.5 bg-white rounded-xl border border-[#DCE5EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                        {del.vehicle_registration_number}
                      </span>
                      <span className="text-xs font-bold text-[#102C42]">{del.driver_name}</span>
                      <span className="text-[11px] text-[#72869A]">({del.delivery_ref})</span>
                    </div>
                    <p className="text-[11px] text-[#72869A]">
                      Destination: <strong className="text-[#102C42]">{del.customer_name}</strong> ({del.city}) • Out KM: <strong className="text-[#102C42] font-mono">{formatNumber(del.vehicle_out_km)}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenStaffReturn(del)}
                    className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-[#0D827D] hover:bg-[#0A6E6A] text-white text-xs font-bold shadow-sm transition-colors self-start sm:self-auto shrink-0"
                  >
                    <Gauge className="w-4 h-4" />
                    <span>Enter Return IN KM</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* EXACTLY THREE MAIN ACTION BUTTONS REQUIRED BY SECTION 3     */}
        {/* 1. Inward Stock Entry                                        */}
        {/* 2. Outward Stock Entry                                       */}
        {/* 3. Manual Stock Entry                                        */}
        {/* ============================================================ */}
        <div className="space-y-2 pt-1">
          <h3 className="text-xs font-bold text-[#72869A] uppercase tracking-wider px-1">
            Main Staff Stock Operations
          </h3>

          <div className="space-y-2.5">
            {/* Action 1: Inward Stock Entry */}
            <button
              onClick={() => navigate('/staff/inward')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border-2 border-[#DCE5EB] hover:border-[#0D827D] active:scale-[0.99] shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0D827D] border border-teal-200 flex items-center justify-center shrink-0 group-hover:bg-[#0D827D] group-hover:text-white transition-colors">
                  <ArrowDownLeft className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#102C42] group-hover:text-[#0D827D] transition-colors">
                    1. Inward Stock Entry
                  </h4>
                  <p className="text-xs text-[#72869A]">
                    Record factory arrivals & received pipes, fittings, tanks
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#72869A] group-hover:text-[#0D827D] transition-colors" />
            </button>

            {/* Action 2: Outward Stock Entry */}
            <button
              onClick={() => navigate('/staff/outward')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border-2 border-[#DCE5EB] hover:border-[#102C42] active:scale-[0.99] shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#102C42] border border-blue-200 flex items-center justify-center shrink-0 group-hover:bg-[#102C42] group-hover:text-white transition-colors">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#102C42] group-hover:text-[#0D827D] transition-colors">
                    2. Outward Stock Entry
                  </h4>
                  <p className="text-xs text-[#72869A]">
                    Record customer delivery dispatches, vehicle & KM readings
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#72869A] group-hover:text-[#102C42] transition-colors" />
            </button>

            {/* Action 3: Manual Stock Entry */}
            <button
              onClick={() => navigate('/staff/manual-entry')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border-2 border-[#DCE5EB] hover:border-[#D97706] active:scale-[0.99] shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#D97706] border border-amber-200 flex items-center justify-center shrink-0 group-hover:bg-[#D97706] group-hover:text-white transition-colors">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#102C42] group-hover:text-[#D97706] transition-colors">
                    3. Manual Stock Entry
                  </h4>
                  <p className="text-xs text-[#72869A]">
                    Physical count verification, spot checks & stock adjustments
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#72869A] group-hover:text-[#D97706] transition-colors" />
            </button>
          </div>
        </div>

        {/* Compact Footer Link to My Entries History */}
        <div className="text-center pt-2">
          <button
            onClick={() => navigate('/staff/my-entries')}
            className="text-xs font-semibold text-[#0D827D] hover:underline inline-flex items-center gap-1"
          >
            <span>View My Recent Entries & Submissions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Staff Vehicle Return KM Modal */}
        {returnModalDelivery && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E7F3F1] text-[#0D827D] flex items-center justify-center font-bold">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#102C42]">Record Vehicle Return (IN KM)</h2>
                    <p className="text-[11px] text-[#72869A]">Godown Staff Arrival Odometer Entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setReturnModalDelivery(null)}
                  className="p-1 text-[#72869A] hover:text-[#102C42] rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStaffReturn} className="p-5 space-y-4">
                {/* Locked Delivery Details Box */}
                <div className="p-3.5 rounded-xl bg-[#F4F7FA] border border-[#DCE5EB] space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#DCE5EB]">
                    <span className="text-[11px] text-[#72869A] uppercase font-bold">Delivery Ref</span>
                    <span className="font-mono font-bold text-[#102C42]">{returnModalDelivery.delivery_ref}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#72869A] uppercase block">Customer / City</span>
                      <strong className="text-[#102C42] truncate block">{returnModalDelivery.customer_name} ({returnModalDelivery.city})</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#72869A] uppercase block">Vehicle Reg</span>
                      <strong className="font-mono text-[#102C42] block">{returnModalDelivery.vehicle_registration_number}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#72869A] uppercase block">Assigned Driver</span>
                      <span className="text-[#102C42] font-semibold block">{returnModalDelivery.driver_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#72869A] uppercase block">Dispatched Items</span>
                      <span className="text-[#102C42] font-semibold block">{returnModalDelivery.items?.length || 0} Line Items</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[#DCE5EB] bg-white p-2 rounded-lg">
                    <span className="text-xs font-bold text-[#72869A] uppercase">Vehicle OUT KM (Locked):</span>
                    <span className="font-mono font-extrabold text-[#102C42] text-sm">
                      {formatNumber(returnModalDelivery.vehicle_out_km)} km
                    </span>
                  </div>
                </div>

                {/* Editable IN KM Field */}
                <div>
                  <label className="label text-xs font-bold text-[#102C42] flex items-center justify-between">
                    <span>Vehicle IN KM (Current Odometer) *</span>
                    <span className="text-[10px] text-[#72869A] font-normal">Must be ≥ {formatNumber(returnModalDelivery.vehicle_out_km)}</span>
                  </label>
                  <div className="relative mt-1">
                    <Gauge className="w-5 h-5 text-[#72869A] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={returnModalDelivery.vehicle_out_km}
                      placeholder={`e.g. ${returnModalDelivery.vehicle_out_km + 50}`}
                      value={staffInKm}
                      onChange={e => setStaffInKm(e.target.value)}
                      required
                      autoFocus
                      className="input-field pl-10 text-lg font-black text-[#102C42] font-mono tracking-wide"
                    />
                  </div>

                  {/* Real-time Distance Calculation Indicator */}
                  {staffInKm && Number(staffInKm) >= returnModalDelivery.vehicle_out_km ? (
                    <div className="mt-2 p-2.5 rounded-xl bg-[#E7F3F1] border border-[#0D827D]/30 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0D827D] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#0D827D]" />
                        <span>Distance Travelled:</span>
                      </span>
                      <span className="font-mono text-sm font-black text-[#0D827D]">
                        {formatNumber(Number(staffInKm) - returnModalDelivery.vehicle_out_km)} km
                      </span>
                    </div>
                  ) : staffInKm && Number(staffInKm) < returnModalDelivery.vehicle_out_km ? (
                    <div className="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>IN KM cannot be less than OUT KM ({formatNumber(returnModalDelivery.vehicle_out_km)} km)</span>
                    </div>
                  ) : null}
                </div>

                {/* Return Remarks */}
                <div>
                  <label className="label text-xs font-semibold text-[#72869A]">
                    Return Notes / Fuel / Condition (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Arrived safely, diesel filled 20L"
                    value={staffReturnNotes}
                    onChange={e => setStaffReturnNotes(e.target.value)}
                    className="input-field text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE5EB]">
                  <button
                    type="button"
                    onClick={() => setReturnModalDelivery(null)}
                    className="btn-secondary py-2 px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !staffInKm ||
                      Number(staffInKm) < returnModalDelivery.vehicle_out_km ||
                      isSavingReturn
                    }
                    className="btn-primary py-2 px-5 text-xs font-bold shadow-sm disabled:opacity-50"
                  >
                    {isSavingReturn ? 'Saving...' : 'Save Return KM & Complete'}
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
