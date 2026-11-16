import React, { useState, useMemo } from 'react'
import {
  ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Calendar, Warehouse as WarehouseIcon,
  Package, FileText, CheckCircle2, AlertCircle, Plus, Clock
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getCategories, getProducts, getWarehouses, getMovements,
  createMovement, getProductStockBalance
} from '../../lib/dataService'
import type { MovementType, StockMovement } from '../../types'
import { formatDate, formatNumber, getStatusColor, getUnitLabel, generateRef } from '../../lib/utils'

export default function StaffMovements() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const categories = useMemo(() => getCategories(), [])
  const products = useMemo(() => getProducts(), [])
  const warehouses = useMemo(() => getWarehouses(), [])

  const defaultWh = profile?.warehouse_id || 'w-2'
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('inward')
  const [quantity, setQuantity] = useState('')
  const [challanNo, setChallanNo] = useState('')
  const [partyName, setPartyName] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter products by selected category
  const categoryProducts = useMemo(() => {
    return products.filter(p => p.category_id === selectedCategoryId && p.is_active)
  }, [products, selectedCategoryId])

  // Current stock balance of selected product in warehouse
  const currentAvailable = useMemo(() => {
    if (!selectedProductId) return 0
    return getProductStockBalance(selectedProductId, warehouseId)
  }, [selectedProductId, warehouseId])

  const selectedProd = products.find(p => p.id === selectedProductId)

  // Movement history for this warehouse/user
  const [movementsList, setMovementsList] = useState<StockMovement[]>(() => {
    return getMovements({ warehouseId })
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!selectedProductId) {
      toast('error', 'Select Product', 'Please choose a product.')
      return
    }
    const numQty = Number(quantity)
    if (!numQty || numQty <= 0) {
      toast('error', 'Invalid Quantity', 'Please enter a valid positive quantity.')
      return
    }

    if (movementType === 'outward' && numQty > currentAvailable) {
      toast('error', 'Insufficient Stock', `Only ${currentAvailable} ${getUnitLabel(selectedProd?.unit)} currently in godown.`)
      return
    }

    setIsSubmitting(true)
    try {
      const refNo = generateRef(movementType === 'inward' ? 'INW' : 'OUT')
      const newMov = createMovement({
        reference_no: refNo,
        movement_type: movementType,
        product_id: selectedProductId,
        warehouse_id: warehouseId,
        quantity: numQty,
        challan_no: challanNo || undefined,
        supplier_customer: partyName || undefined,
        notes: notes || undefined,
        created_by: profile.id,
        creator_name: profile.full_name,
        status: 'submitted'
      }, profile)

      toast('success', 'Movement Logged', `${movementType.toUpperCase()} of ${numQty} units submitted for approval.`)

      // Reset form
      setQuantity('')
      setChallanNo('')
      setPartyName('')
      setNotes('')
      // Refresh list
      setMovementsList(getMovements({ warehouseId }))
    } catch (err: any) {
      toast('error', 'Failed to Record Movement', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <StaffLayout title="Inward / Outward Movements">
      <div className="space-y-4">
        {/* Record Transaction Card */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-brand-border">
            <ArrowLeftRight className="w-5 h-5 text-teal-DEFAULT" />
            <h3 className="font-bold text-sm text-navy-DEFAULT">Record Stock Movement</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Movement Type Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-brand-bg rounded-xl border border-brand-border">
              <button
                type="button"
                onClick={() => setMovementType('inward')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  movementType === 'inward'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-brand-textSecondary hover:text-navy-DEFAULT'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Inward (Received)</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('outward')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  movementType === 'outward'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-brand-textSecondary hover:text-navy-DEFAULT'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Outward (Dispatch)</span>
              </button>
            </div>

            {/* Warehouse Select */}
            <div>
              <label className="label">Godown Location</label>
              <select
                className="input-field text-xs font-medium"
                value={warehouseId}
                disabled={profile?.role === 'staff' && Boolean(profile.warehouse_id)}
                onChange={e => setWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            {/* Category Select */}
            <div>
              <label className="label">Category</label>
              <select
                className="input-field text-xs font-medium"
                value={selectedCategoryId}
                onChange={e => {
                  setSelectedCategoryId(e.target.value)
                  setSelectedProductId('')
                }}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Product Select */}
            <div>
              <label className="label">Product / Specification</label>
              <select
                className="input-field text-xs font-medium"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {categoryProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Available stock indicator */}
            {selectedProductId && (
              <div className="p-2.5 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-between text-xs">
                <span className="text-brand-textSecondary">Current In-Stock:</span>
                <span className="font-bold text-navy-DEFAULT">
                  {formatNumber(currentAvailable)} {getUnitLabel(selectedProd?.unit)}
                </span>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="label">
                Quantity {selectedProd ? `(${getUnitLabel(selectedProd.unit)})` : ''}
              </label>
              <input
                type="number"
                min="1"
                step={selectedProd?.unit === 'piece' || selectedProd?.unit === 'tank' ? '1' : 'any'}
                inputMode="numeric"
                className="input-field text-sm font-bold"
                placeholder="Enter quantity"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </div>

            {/* Challan & Party Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="label">Challan / Invoice No</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder="e.g. CH-8891 or INV-402"
                  value={challanNo}
                  onChange={e => setChallanNo(e.target.value)}
                />
              </div>

              <div>
                <label className="label">{movementType === 'inward' ? 'Supplier Name' : 'Customer / Project'}</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  placeholder={movementType === 'inward' ? 'e.g. Finolex Industries' : 'e.g. Kisan Agro Traders'}
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes</label>
              <input
                type="text"
                className="input-field text-xs"
                placeholder="Vehicle number, driver name, condition notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-2.5 mt-2 flex items-center justify-center gap-1.5 font-bold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Record {movementType === 'inward' ? 'Inward' : 'Outward'} Movement</span>
            </button>
          </form>
        </div>

        {/* History of Recent Movements */}
        <div>
          <h3 className="text-xs font-bold text-brand-textSecondary uppercase tracking-wider mb-2.5 px-0.5">
            Godown Movement Register
          </h3>

          <div className="bg-white rounded-2xl border border-brand-border shadow-card divide-y divide-brand-border/60 overflow-hidden">
            {movementsList.length === 0 ? (
              <div className="p-6 text-center text-xs text-brand-textSecondary">
                No movements recorded for this location yet.
              </div>
            ) : (
              movementsList.map(m => {
                const isInward = m.movement_type === 'inward' || m.movement_type === 'return'
                return (
                  <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isInward ? 'bg-green-100 text-brand-success' : 'bg-red-100 text-brand-error'}`}>
                        {isInward ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-brand-textPrimary truncate">{m.product?.name ?? 'Product'}</p>
                        <p className="text-[11px] text-brand-textSecondary truncate">
                          {m.supplier_customer || m.challan_no || m.reference_no} • {formatDate(m.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`font-bold ${isInward ? 'text-brand-success' : 'text-brand-error'}`}>
                        {isInward ? '+' : '-'}{formatNumber(m.quantity)} {m.product?.unit ?? 'Pcs'}
                      </p>
                      <span className={`inline-block text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-full ${getStatusColor(m.status)}`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </StaffLayout>
  )
}
