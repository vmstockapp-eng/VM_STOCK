import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight, Plus, Trash2, CheckCircle2, Clock, ChevronRight,
  ArrowLeft, Save, Send, Truck, User, Gauge, FileText, X
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getWarehouses, getProducts, getVehicles, getDrivers,
  saveOutwardDelivery, getProductStockBalance,
  getDeliveryById, getDeliveryDrafts, deleteDeliveryDraft, hydrateCatalogCacheFromSupabase
} from '../../lib/dataService'
import type { DeliveryItem, OutwardDelivery } from '../../types'
import { generateRef, formatNumber, getUnitLabel } from '../../lib/utils'
import { persistOutwardDelivery } from '../../lib/staffTransactionService'

export default function StaffOutwardDelivery() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const draftParam = searchParams.get('draftId') || searchParams.get('ref')

  const warehouses = useMemo(() => getWarehouses(), [])
  const allProducts = useMemo(() => getProducts(), [])
  const [catalogVersion, setCatalogVersion] = useState(0)
  const registeredVehicles = useMemo(() => getVehicles(true), [catalogVersion])
  const registeredDrivers = useMemo(() => getDrivers(true), [catalogVersion])

  // Ensure vehicle/driver dropdowns use the shared Supabase-backed catalog,
  // not an empty cache captured on the first render.
  useEffect(() => {
    let active = true
    hydrateCatalogCacheFromSupabase()
      .then(() => { if (active) setCatalogVersion(v => v + 1) })
      .catch(error => console.error('Unable to refresh vehicle/driver catalog:', error))
    return () => { active = false }
  }, [])

  const defaultWhId = profile?.warehouse_id || ''
  const [warehouseId, setWarehouseId] = useState<string>(defaultWhId)

  // Delivery Document Details
  const [deliveryRef, setDeliveryRef] = useState<string>(() => draftParam || generateRef('OUT'))
  const [isDraftMode, setIsDraftMode] = useState<boolean>(Boolean(draftParam))
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [doNumber, setDoNumber] = useState('')
  const [memoNumber, setMemoNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [city, setCity] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // 4 Default Pipe Sizes (63, 75, 90, 110)
  const defaultPvcPipes = useMemo(() => {
    return {
      '63': allProducts.find(p => p.sku === 'PVC-63-4' || p.diameter_mm === 63) || allProducts[0],
      '75': allProducts.find(p => p.sku === 'PVC-75-4' || p.diameter_mm === 75) || allProducts[1],
      '90': allProducts.find(p => p.sku === 'PVC-90-4' || p.diameter_mm === 90) || allProducts[2],
      '110': allProducts.find(p => p.sku === 'PVC-110-4' || p.diameter_mm === 110) || allProducts[3],
    }
  }, [allProducts])

  // Quantities for default sizes
  const [defaultSizeQtys, setDefaultSizeQtys] = useState<Record<string, string>>({
    '63': '',
    '75': '',
    '90': '',
    '110': ''
  })

  // Additional Products Dynamic Rows
  const [extraItems, setExtraItems] = useState<{ id: string; productId: string; quantity: string }[]>([])

  // Fittings Details
  const [fittingsDetails, setFittingsDetails] = useState('')

  // Vehicle Selection
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [otherVehicleNumber, setOtherVehicleNumber] = useState('')

  // Driver Selection
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [otherDriverName, setOtherDriverName] = useState('')
  const [otherDriverPhone, setOtherDriverPhone] = useState('')
  const [otherDriverAddress, setOtherDriverAddress] = useState('')

  // Vehicle Odometer Readings
  const [vehicleOutKm, setVehicleOutKm] = useState<string>('')

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedSuccessRef, setSavedSuccessRef] = useState<string | null>(null)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [draftsVersion, setDraftsVersion] = useState(0)

  // Current stock balances for default 4 sizes in working godown
  const defaultStockBalances = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [size, prod] of Object.entries(defaultPvcPipes)) {
      if (prod) {
        map[size] = getProductStockBalance(prod.id, warehouseId)
      } else {
        map[size] = 0
      }
    }
    return map
  }, [defaultPvcPipes, warehouseId])

  // Available outward drafts
  const outwardDrafts = useMemo(() => {
    return getDeliveryDrafts(warehouseId)
  }, [warehouseId, draftsVersion])

  // Load draft if draftParam is present
  useEffect(() => {
    if (draftParam) {
      const draft = getDeliveryById(draftParam)
      if (draft) {
        setDeliveryRef(draft.delivery_ref)
        setIsDraftMode(true)
        setWarehouseId(draft.warehouse_id)
        setEntryDate(draft.date)
        setDoNumber(draft.do_number && draft.do_number !== '—' ? draft.do_number : '')
        setMemoNumber(draft.memo_number && draft.memo_number !== '—' ? draft.memo_number : '')
        setCustomerName(draft.customer_name && draft.customer_name !== 'Walk-in / Cash' ? draft.customer_name : '')
        setCity(draft.city && draft.city !== 'Local' ? draft.city : '')
        setDeliveryAddress(draft.delivery_address || '')
        setDeliveryNotes(draft.delivery_notes || '')
        setFittingsDetails(draft.fittings_details || '')

        if (draft.vehicle_id) {
          setSelectedVehicleId(draft.vehicle_id)
        } else if (draft.other_vehicle_number || draft.vehicle_registration_number) {
          setSelectedVehicleId('other')
          setOtherVehicleNumber(draft.other_vehicle_number || draft.vehicle_registration_number)
        }

        if (draft.driver_id) {
          setSelectedDriverId(draft.driver_id)
        } else if (draft.driver_name) {
          setSelectedDriverId('other')
          setOtherDriverName(draft.driver_name)
          setOtherDriverPhone(draft.other_driver_phone || '')
          setOtherDriverAddress(draft.other_driver_address || '')
        }

        setVehicleOutKm(draft.vehicle_out_km ? String(draft.vehicle_out_km) : '')

        // Populate items
        const defQtys: Record<string, string> = { '63': '', '75': '', '90': '', '110': '' }
        const extras: { id: string; productId: string; quantity: string }[] = []

        for (const it of draft.items) {
          if (it.size_label && ['63', '75', '90', '110'].includes(it.size_label)) {
            defQtys[it.size_label] = String(it.quantity)
          } else {
            extras.push({
              id: it.id,
              productId: it.product_id,
              quantity: String(it.quantity)
            })
          }
        }
        setDefaultSizeQtys(defQtys)
        setExtraItems(extras)
      }
    }
  }, [draftParam])

  const handleAddExtraItem = () => {
    const unselected = allProducts.find(p => !['PVC-63-4', 'PVC-75-4', 'PVC-90-4', 'PVC-110-4'].includes(p.sku))
    setExtraItems(prev => [
      ...prev,
      {
        id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        productId: unselected?.id || allProducts[0].id,
        quantity: ''
      }
    ])
  }

  const handleRemoveExtraItem = (id: string) => {
    setExtraItems(prev => prev.filter(it => it.id !== id))
  }

  const handleExtraProductChange = (id: string, productId: string) => {
    setExtraItems(prev => prev.map(it => it.id === id ? { ...it, productId } : it))
  }

  const handleExtraQtyChange = (id: string, quantity: string) => {
    setExtraItems(prev => prev.map(it => it.id === id ? { ...it, quantity } : it))
  }

  const handleResumeDraft = (draft: OutwardDelivery) => {
    setSearchParams({ draftId: draft.delivery_ref })
    setShowDraftsModal(false)
  }

  const handleDeleteDraft = (e: React.MouseEvent, ref: string) => {
    e.stopPropagation()
    deleteDeliveryDraft(ref)
    setDraftsVersion(v => v + 1)
    toast('info', 'Draft Deleted', `Draft ${ref} has been removed.`)
    if (deliveryRef === ref) {
      setDeliveryRef(generateRef('OUT'))
      setIsDraftMode(false)
      setSearchParams({})
    }
  }

  const validateAndSubmit = async (isDraft: boolean) => {
    if (!profile) return

    if (!isDraft) {
      if (!customerName.trim()) {
        toast('error', 'Missing Customer', 'Please enter the Customer Name.')
        return
      }
      if (!city.trim()) {
        toast('error', 'Missing City', 'Please enter Destination City.')
        return
      }
      if (!doNumber.trim() && !memoNumber.trim()) {
        toast('error', 'Missing Document No', 'Please enter at least a D.O. No. or Cash/Credit Memo No.')
        return
      }
      if (!vehicleOutKm.trim() || Number(vehicleOutKm) <= 0) {
        toast('error', 'Missing Odometer KM', 'Please enter Vehicle Out KM reading at dispatch.')
        return
      }
      if (!selectedVehicleId) {
        toast('error', 'Vehicle Required', 'Please select a registered vehicle or choose Other / External Vehicle.')
        return
      }
      if (!selectedDriverId) {
        toast('error', 'Driver Required', 'Please select a registered driver or choose Other / Outside Driver.')
        return
      }
      if (selectedVehicleId === 'other' && !otherVehicleNumber.trim()) {
        toast('error', 'Vehicle Registration Required', 'Please enter the registration number for Other Vehicle.')
        return
      }
      if (selectedDriverId === 'other' && !otherDriverName.trim()) {
        toast('error', 'Driver Name Required', 'Please enter Driver Name.')
        return
      }
    }

    // Build items list
    const items: DeliveryItem[] = []

    // 1. Default sizes
    for (const [size, qtyStr] of Object.entries(defaultSizeQtys)) {
      const q = Number(qtyStr)
      if (q > 0) {
        const prod = defaultPvcPipes[size as keyof typeof defaultPvcPipes]
        if (prod) {
          if (!isDraft) {
            const avail = defaultStockBalances[size] || 0
            if (q > avail) {
              toast('error', 'Insufficient Stock', `Stock for size ${size}mm is only ${avail} ${getUnitLabel(prod.unit)}. You entered ${q}.`)
              return
            }
          }
          items.push({
            id: `item-def-${size}`,
            delivery_id: deliveryRef,
            product_id: prod.id,
            quantity: q,
            unit: prod.unit,
            size_label: size
          })
        }
      }
    }

    // 2. Extra items
    for (const extra of extraItems) {
      const q = Number(extra.quantity)
      if (q > 0) {
        const prod = allProducts.find(p => p.id === extra.productId)
        if (prod) {
          if (!isDraft) {
            const avail = getProductStockBalance(prod.id, warehouseId)
            if (q > avail) {
              toast('error', 'Insufficient Stock', `Stock for ${prod.name} is only ${avail} ${getUnitLabel(prod.unit)}. You entered ${q}.`)
              return
            }
          }
          items.push({
            id: extra.id,
            delivery_id: deliveryRef,
            product_id: prod.id,
            quantity: q,
            unit: prod.unit,
            size_label: prod.diameter_mm ? `${prod.diameter_mm}` : undefined
          })
        }
      }
    }

    if (!isDraft && items.length === 0 && !fittingsDetails.trim()) {
      toast('error', 'No Materials Entered', 'Please enter product quantities or fittings details for this delivery.')
      return
    }

    // Resolve vehicle registration
    let resolvedVehicleReg = ''
    let chosenVehicleId: string | null = null
    if (selectedVehicleId && selectedVehicleId !== 'other') {
      const v = registeredVehicles.find(veh => veh.id === selectedVehicleId)
      resolvedVehicleReg = v ? v.registration_number : ''
      chosenVehicleId = selectedVehicleId
    } else if (selectedVehicleId === 'other') {
      resolvedVehicleReg = otherVehicleNumber.trim().toUpperCase()
    }

    // Resolve driver name
    let resolvedDriverName = ''
    let chosenDriverId: string | null = null
    if (selectedDriverId && selectedDriverId !== 'other') {
      const d = registeredDrivers.find(drv => drv.id === selectedDriverId)
      resolvedDriverName = d ? d.full_name : ''
      chosenDriverId = selectedDriverId
    } else if (selectedDriverId === 'other') {
      resolvedDriverName = otherDriverName.trim()
    }

    setIsSubmitting(true)
    try {
      const deliveryPayload: Omit<OutwardDelivery, 'id' | 'created_at'> = {
        delivery_ref: deliveryRef,
        warehouse_id: warehouseId,
        date: entryDate,
        do_number: doNumber.trim() || '—',
        memo_number: memoNumber.trim() || '—',
        customer_name: customerName.trim() || 'Walk-in / Cash',
        city: city.trim() || 'Local',
        delivery_address: deliveryAddress.trim() || null,
        delivery_notes: deliveryNotes.trim() || null,
        fittings_details: fittingsDetails.trim() || null,

        vehicle_id: chosenVehicleId,
        vehicle_registration_number: resolvedVehicleReg,
        other_vehicle_number: selectedVehicleId === 'other' ? otherVehicleNumber.trim().toUpperCase() : null,

        driver_id: chosenDriverId,
        driver_name: resolvedDriverName,
        other_driver_phone: selectedDriverId === 'other' ? otherDriverPhone.trim() : null,
        other_driver_address: selectedDriverId === 'other' ? otherDriverAddress.trim() : null,

        vehicle_out_km: Number(vehicleOutKm) || 0,
        dispatch_timestamp: new Date().toISOString(),
        vehicle_in_km: null,
        return_timestamp: null,
        distance_travelled: null,

        status: isDraft ? 'draft' : 'awaiting_return',
        items,

        created_by: profile.id,
        creator_name: profile.full_name
      }

      // The database transaction is authoritative; only update the local UI after it succeeds.
      await persistOutwardDelivery(deliveryPayload, profile)
      await hydrateCatalogCacheFromSupabase()
      const newDelivery = getDeliveryById(deliveryPayload.delivery_ref) ?? { ...deliveryPayload, id: deliveryPayload.delivery_ref, created_at: new Date().toISOString() }

      setDraftsVersion(v => v + 1)

      if (isDraft) {
        setIsDraftMode(true)
        toast('info', 'Draft Saved', `Outward delivery draft ${newDelivery.delivery_ref} saved. Stock has not been deducted.`)
      } else {
        setSavedSuccessRef(newDelivery.delivery_ref)
        toast('success', 'Delivery Registered', `Outward delivery ${newDelivery.delivery_ref} submitted. Official stock deducted immediately.`)
      }
    } catch (err: any) {
      toast('error', 'Operation Failed', err.message || 'Error occurred while saving.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (savedSuccessRef) {
    return (
      <StaffLayout>
        <div className="max-w-xl mx-auto py-8 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 text-[#16845B] flex items-center justify-center mx-auto mb-4 border-2 border-green-300">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-bold text-[#102C42] mb-1">Outward Delivery Successfully Saved!</h2>
          <p className="text-sm text-[#72869A] mb-6">
            Delivery Reference: <span className="font-mono font-bold text-[#102C42] bg-[#F4F7FA] px-2.5 py-1 rounded-lg border border-[#DCE5EB]">{savedSuccessRef}</span>
          </p>

          <div className="p-4 rounded-2xl bg-[#E7F3F1] border border-[#0D827D]/30 text-left mb-6 text-xs text-[#20384A] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#0D827D]">
              <Clock className="w-4 h-4" />
              <span>Status: Awaiting Vehicle Return</span>
            </div>
            <p>
              Stock has been reduced in Godown ledger immediately (no approval required). When the vehicle returns to the godown, staff records <strong>Vehicle IN KM</strong> to complete distance tracking.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setSavedSuccessRef(null)
                setDeliveryRef(generateRef('OUT'))
                setIsDraftMode(false)
                setDefaultSizeQtys({ '63': '', '75': '', '90': '', '110': '' })
                setExtraItems([])
                setDoNumber('')
                setMemoNumber('')
                setCustomerName('')
                setCity('')
                setVehicleOutKm('')
                setSearchParams({})
              }}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create Another Delivery</span>
            </button>
            <button
              onClick={() => navigate('/staff/stock')}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Stock Operations Hub</span>
            </button>
          </div>
        </div>
      </StaffLayout>
    )
  }

  return (
    <StaffLayout>
      <div className="space-y-4 pb-12 max-w-2xl mx-auto">
        {/* Header with Back button & Drafts */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/staff/stock')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#72869A] hover:text-[#102C42]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Stock Operations</span>
          </button>

          <div className="flex items-center gap-2">
            {outwardDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D827D] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl hover:bg-teal-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Drafts ({outwardDrafts.length})</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#0D827D] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl">
              <span>Ref: {deliveryRef}</span>
            </div>
          </div>
        </div>

        {/* Draft Mode Banner */}
        {isDraftMode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Editing Outward Delivery Draft #{deliveryRef}</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Stock has <strong>not</strong> been deducted yet. You can update details and submit when goods are loaded.
              </p>
            </div>
          </div>
        )}

        {/* Title banner */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#102C42] border border-blue-200 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#102C42]">Outward Stock Delivery</h1>
              <p className="text-xs text-[#72869A]">Dispatch goods to customer & record vehicle odometer</p>
            </div>
          </div>
        </div>

        {/* Working Godown & Date */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
            1. Working Godown & Date
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Dispatch Godown</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="input-field"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Dispatch Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Step A: Delivery Document Information */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
            2. Customer & Document Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">D.O. Number *</label>
              <input
                type="text"
                placeholder="e.g. DO-2026-889"
                value={doNumber}
                onChange={e => setDoNumber(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Cash / Credit Memo No.</label>
              <input
                type="text"
                placeholder="e.g. MEMO-4412"
                value={memoNumber}
                onChange={e => setMemoNumber(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Customer / Party Name *</label>
              <input
                type="text"
                placeholder="e.g. Pravin Traders / Balaji Agro"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Destination City / Taluka *</label>
              <input
                type="text"
                placeholder="e.g. Baramati, Pune"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label">Delivery Address / Site Landmark (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Gat 144, Near Toll Plaza, NH-48"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Delivery Notes / Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Urgent morning delivery, recipient contact Mohan Patil"
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              className="input-field text-xs resize-none"
            />
          </div>
        </div>

        {/* Step B: 4 Default PVC Pipe Sizes */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#DCE5EB]">
            <div>
              <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
                3. Standard Fast-Moving PVC Pipes (4 kg Class)
              </h2>
              <p className="text-[11px] text-[#72869A]">Pre-populated standard 6-meter pipe sizes</p>
            </div>
            <span className="text-[10px] font-bold bg-[#E7F3F1] text-[#0D827D] px-2 py-0.5 rounded-full">
              4 Default Sizes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {(['63', '75', '90', '110'] as const).map(size => {
              const prod = defaultPvcPipes[size]
              const avail = defaultStockBalances[size] || 0
              const qtyVal = defaultSizeQtys[size]
              const isOverStock = Number(qtyVal) > avail

              return (
                <div
                  key={size}
                  className={`p-3 rounded-xl border transition-all ${
                    isOverStock
                      ? 'border-red-300 bg-red-50/50'
                      : 'border-[#DCE5EB] bg-[#F4F7FA]/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-xs text-[#102C42]">
                        {size} mm × 4 kg Pipe
                      </span>
                      <p className="text-[10px] text-[#72869A]">
                        {prod ? prod.name : `Standard ${size}mm PVC 6m`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#72869A] block">Godown Stock</span>
                      <span className={`text-xs font-bold ${avail > 0 ? 'text-[#102C42]' : 'text-red-600'}`}>
                        {formatNumber(avail)} pcs
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="0 pcs"
                      value={qtyVal}
                      onChange={e => setDefaultSizeQtys(prev => ({ ...prev, [size]: e.target.value }))}
                      className="input-field text-right font-extrabold text-[#102C42]"
                    />
                    <span className="text-xs font-semibold text-[#72869A] shrink-0">pcs</span>
                  </div>

                  {isOverStock && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1">
                      ⚠️ Exceeds current godown stock ({avail} pcs)
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step C: Extra Products Dynamic Rows */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#DCE5EB]">
            <div>
              <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
                4. Additional Products & Coils
              </h2>
              <p className="text-[11px] text-[#72869A]">Add HDPE coils, tanks, SWR, or other diameters</p>
            </div>
            <button
              type="button"
              onClick={handleAddExtraItem}
              className="text-xs font-bold text-[#0D827D] hover:text-[#102C42] flex items-center gap-1 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          {extraItems.length === 0 ? (
            <p className="text-xs text-[#72869A] py-2 text-center italic">
              No extra products added. Click "+ Add Item" if delivering HDPE coils, tanks, or special sizes.
            </p>
          ) : (
            <div className="space-y-2.5 pt-1">
              {extraItems.map((extra, idx) => {
                const prod = allProducts.find(p => p.id === extra.productId)
                const avail = prod ? getProductStockBalance(prod.id, warehouseId) : 0
                const isOverStock = Number(extra.quantity) > avail

                return (
                  <div
                    key={extra.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 ${
                      isOverStock ? 'border-red-300 bg-red-50/50' : 'border-[#DCE5EB] bg-[#F4F7FA]/70'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#72869A] sm:w-6">{idx + 1}.</span>

                    <div className="flex-1 min-w-0">
                      <select
                        value={extra.productId}
                        onChange={e => handleExtraProductChange(extra.id, e.target.value)}
                        className="input-field text-xs font-medium py-1.5"
                      >
                        {allProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      {prod && (
                        <span className="text-[10px] text-[#72869A] mt-0.5 block">
                          Current Stock: <strong className="text-[#102C42]">{formatNumber(avail)}</strong> {getUnitLabel(prod.unit)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:w-36">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={extra.quantity}
                        onChange={e => handleExtraQtyChange(extra.id, e.target.value)}
                        className="input-field text-right font-extrabold text-[#102C42]"
                      />
                      <span className="text-xs font-semibold text-[#72869A] shrink-0 w-8">
                        {prod ? getUnitLabel(prod.unit) : 'units'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraItem(extra.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Step D: Fittings Details */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-2">
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
            5. Fittings & Accessories Details
          </h2>
          <p className="text-[11px] text-[#72869A]">
            Enter free-form description of fittings, elbows, tees, solvent cement, or valves included in this vehicle
          </p>
          <textarea
            rows={2}
            placeholder="e.g. 10 bags 63mm Elbows, 5 bags 75mm Tees, 4 tins solvent cement (500ml)"
            value={fittingsDetails}
            onChange={e => setFittingsDetails(e.target.value)}
            className="input-field text-xs resize-none"
          />
        </div>

        {/* Step E: Vehicle & Driver Selection with Out KM */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-4">
          <div className="pb-1 border-b border-[#DCE5EB]">
            <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
              6. Vehicle, Driver & Odometer Dispatch Reading
            </h2>
            <p className="text-[11px] text-[#72869A]">Select dispatch vehicle and driver or enter custom details</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vehicle Selection */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#0D827D]" />
                <span>Select Vehicle *</span>
              </label>
              <select
                value={selectedVehicleId}
                onChange={e => {
                  const value = e.target.value
                  setSelectedVehicleId(value)
                  if (value !== 'other') setOtherVehicleNumber('')
                }}
                className="input-field"
              >
                <option value="">— Select vehicle —</option>
                {registeredVehicles.map(veh => (
                  <option key={veh.id} value={veh.id}>
                    {veh.registration_number} — {veh.name} ({veh.vehicle_type})
                  </option>
                ))}
                <option value="other">+ Other / External Vehicle</option>
              </select>
            </div>

            {/* Driver Selection */}
            <div>
              <label className="label flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#0D827D]" />
                <span>Assigned Driver *</span>
              </label>
              <select
                value={selectedDriverId}
                onChange={e => {
                  const value = e.target.value
                  setSelectedDriverId(value)
                  if (value !== 'other') {
                    setOtherDriverName('')
                    setOtherDriverPhone('')
                    setOtherDriverAddress('')
                  }
                }}
                className="input-field"
              >
                <option value="">— Select driver —</option>
                {registeredDrivers.map(drv => (
                  <option key={drv.id} value={drv.id}>
                    {drv.full_name} {drv.phone ? `(${drv.phone})` : ''}
                  </option>
                ))}
                <option value="other">+ Other / Outside Driver</option>
              </select>
            </div>
          </div>

          {/* If Other Vehicle chosen */}
          {selectedVehicleId === 'other' && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
              <label className="label text-amber-900 font-bold">External Vehicle Registration Number *</label>
              <input
                type="text"
                placeholder="e.g. MH 12 AB 1234"
                value={otherVehicleNumber}
                onChange={e => setOtherVehicleNumber(e.target.value)}
                className="input-field uppercase font-mono"
              />
            </div>
          )}

          {/* If Other Driver chosen */}
          {selectedDriverId === 'other' && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 animate-in fade-in">
              <div>
                <label className="label text-blue-900 font-bold">Driver Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kulkarni"
                  value={otherDriverName}
                  onChange={e => setOtherDriverName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="label text-blue-900">Contact Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98221 00000"
                    value={otherDriverPhone}
                    onChange={e => setOtherDriverPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label text-blue-900">Driver Address / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Bhosari, Pune"
                    value={otherDriverAddress}
                    onChange={e => setOtherDriverAddress(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Out KM */}
          <div className="p-3 bg-[#E7F3F1] border border-[#0D827D]/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#102C42] flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#0D827D]" />
                <span>Vehicle OUT KM (At Dispatch) *</span>
              </label>
              <span className="text-[10px] text-[#0D827D] font-bold">Initial Odometer</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="e.g. 45280"
                value={vehicleOutKm}
                onChange={e => setVehicleOutKm(e.target.value)}
                className="input-field font-mono font-extrabold text-base text-[#102C42]"
              />
              <span className="text-xs font-bold text-[#72869A] shrink-0">KM</span>
            </div>
            <p className="text-[11px] text-[#0D827D]">
              Note: Staff records Vehicle IN KM upon return to calculate distance travelled.
            </p>
          </div>
        </div>

        {/* Action Buttons: Save Draft vs Submit Outward Entry */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => validateAndSubmit(true)}
            className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
          >
            <Save className="w-4 h-4" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => validateAndSubmit(false)}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : isDraftMode ? 'Submit Official Delivery' : 'Save Outward Entry'}</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-[#72869A]">
          Drafts do not reduce stock. Once submitted, stock is deducted immediately in the official stock ledger.
        </p>

        {/* Drafts Modal */}
        {showDraftsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-xl border border-[#DCE5EB] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D827D]" />
                  <h3 className="text-sm font-bold text-[#102C42]">Saved Outward Drafts</h3>
                </div>
                <button
                  onClick={() => setShowDraftsModal(false)}
                  className="text-[#72869A] hover:text-[#102C42] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {outwardDrafts.map(d => (
                  <div
                    key={d.id}
                    onClick={() => handleResumeDraft(d)}
                    className="p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA] hover:border-[#0D827D] hover:bg-white cursor-pointer transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#0D827D]">{d.delivery_ref}</span>
                        <span className="text-[10px] text-[#72869A]">{d.date}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#102C42] truncate">{d.customer_name} ({d.city})</p>
                      <p className="text-[10px] text-[#72869A]">Vehicle: {d.vehicle_registration_number} • {d.items.length} items</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDraft(e, d.delivery_ref)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-[#0D827D]" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowDraftsModal(false)}
                  className="btn-secondary text-xs px-4 py-1.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
