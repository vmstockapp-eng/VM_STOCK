import React, { useState, useMemo } from 'react'
import {
  ArrowLeftRight, Plus, ArrowDownLeft, ArrowUpRight, Search,
  Warehouse as WarehouseIcon, Package, CheckCircle2, RotateCw
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import {
  getMovements, getWarehouses, getProducts, getCategories,
  createMovement, getProductStockBalance
} from '../../lib/dataService'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import { formatDate, formatNumber, getStatusColor, getUnitLabel, generateRef } from '../../lib/utils'
import type { MovementType, StockMovement } from '../../types'

export default function AdminMovements() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const warehouses = useMemo(() => getWarehouses(), [])
  const products = useMemo(() => getProducts(), [])
  const categories = useMemo(() => getCategories(), [])

  const [movementsList, setMovementsList] = useState<StockMovement[]>(() => getMovements())
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Form Fields
  const [movementType, setMovementType] = useState<MovementType>('transfer_out')
  const [sourceWarehouseId, setSourceWarehouseId] = useState(warehouses[1]?.id || '')
  const [destWarehouseId, setDestWarehouseId] = useState(warehouses[2]?.id || '')
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '')
  const [quantity, setQuantity] = useState('')
  const [challanNo, setChallanNo] = useState('')
  const [supplierCustomer, setSupplierCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProd = products.find(p => p.id === selectedProductId)
  const currentAvailable = useMemo(() => {
    if (!selectedProductId || !sourceWarehouseId) return 0
    return getProductStockBalance(selectedProductId, sourceWarehouseId)
  }, [selectedProductId, sourceWarehouseId])

  const openModal = () => {
    setMovementType('transfer_out')
    setSourceWarehouseId(warehouses[1]?.id || '')
    setDestWarehouseId(warehouses[2]?.id || '')
    setSelectedProductId(products[0]?.id || '')
    setQuantity('')
    setChallanNo('')
    setSupplierCustomer('')
    setNotes('')
    setModalOpen(true)
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    const numQty = Number(quantity)
    if (!numQty || numQty <= 0) {
      toast('error', 'Invalid Quantity', 'Please enter a positive numeric quantity.')
      return
    }

    if ((movementType === 'outward' || movementType === 'transfer_out') && numQty > currentAvailable) {
      toast('error', 'Insufficient Stock', `Only ${currentAvailable} available in source location.`)
      return
    }

    if (movementType === 'transfer_out' && sourceWarehouseId === destWarehouseId) {
      toast('error', 'Invalid Transfer', 'Source and destination godowns must be different.')
      return
    }

    setIsSubmitting(true)
    try {
      const ref = generateRef(movementType.toUpperCase().slice(0, 3))
      createMovement({
        reference_no: ref,
        movement_type: movementType,
        product_id: selectedProductId,
        warehouse_id: sourceWarehouseId,
        dest_warehouse_id: movementType === 'transfer_out' ? destWarehouseId : null,
        quantity: numQty,
        challan_no: challanNo || undefined,
        supplier_customer: supplierCustomer || undefined,
        notes: notes || undefined,
        created_by: profile.id,
        creator_name: profile.full_name,
        status: 'posted', // Admin posted directly updates ledger
        posted_at: new Date().toISOString()
      }, profile)

      setMovementsList(getMovements())
      setModalOpen(false)
      toast('success', 'Movement Posted', `${movementType.replace('_', ' ').toUpperCase()} of ${numQty} units posted directly to stock ledger.`)
    } catch (err: any) {
      toast('error', 'Transaction Failed', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AdminLayout title="Stock Movements & Inter-Godown Transfers">
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref no, challan, product..."
              className="input-field pl-9 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            onClick={openModal}
            className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Movement / Transfer
          </button>
        </div>

        {/* Movements Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
              <tr>
                <th className="py-3 px-4">Ref / Date</th>
                <th className="py-3 px-4">Movement Type</th>
                <th className="py-3 px-4">Source Godown</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Product SKU & Name</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Party / Challan</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {movementsList.map(m => {
                const isInward = m.movement_type === 'inward' || m.movement_type === 'return' || m.movement_type === 'transfer_in'
                return (
                  <tr key={m.id} className="hover:bg-brand-bg/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-navy-DEFAULT block">{m.reference_no}</span>
                      <span className="text-[10px] text-brand-textSecondary">{formatDate(m.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold uppercase text-[10px] ${isInward ? 'text-brand-success' : 'text-brand-error'}`}>
                        {isInward ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {m.movement_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-navy-DEFAULT">
                      {m.warehouse?.name}
                    </td>
                    <td className="py-3 px-4 text-brand-textSecondary">
                      {m.dest_warehouse?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-navy-DEFAULT">{m.product?.sku}</span>
                      <span className="block text-[11px] text-brand-textSecondary truncate max-w-[160px]">{m.product?.name}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-navy-DEFAULT">
                      {isInward ? '+' : '−'}{formatNumber(m.quantity)} {getUnitLabel(m.product?.unit)}
                    </td>
                    <td className="py-3 px-4 text-brand-textSecondary truncate max-w-[120px]">
                      {m.supplier_customer || m.challan_no || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Modal: Record Movement */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Record Stock Movement / Transfer"
          size="md"
        >
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="label">Movement Type *</label>
              <select
                className="input-field text-xs font-bold capitalize"
                value={movementType}
                onChange={e => setMovementType(e.target.value as MovementType)}
              >
                <option value="transfer_out">Inter-Godown Transfer</option>
                <option value="inward">Inward (Supplier Goods Receipt)</option>
                <option value="outward">Outward (Customer Dispatch)</option>
                <option value="return">Customer Return</option>
                <option value="adjustment">Stock Adjustment (Audit)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  {movementType === 'transfer_out' ? 'Source Warehouse *' : 'Location *'}
                </label>
                <select
                  className="input-field text-xs font-medium"
                  value={sourceWarehouseId}
                  onChange={e => setSourceWarehouseId(e.target.value)}
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              {movementType === 'transfer_out' && (
                <div>
                  <label className="label">Destination Warehouse *</label>
                  <select
                    className="input-field text-xs font-medium"
                    value={destWarehouseId}
                    onChange={e => setDestWarehouseId(e.target.value)}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="label">Select Product SKU *</label>
              <select
                className="input-field text-xs font-medium"
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </div>

            {/* In-Stock Indicator */}
            <div className="p-2.5 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-between text-xs">
              <span className="text-brand-textSecondary">Available at Source Yard:</span>
              <span className="font-bold text-navy-DEFAULT">
                {formatNumber(currentAvailable)} {getUnitLabel(selectedProd?.unit)}
              </span>
            </div>

            <div>
              <label className="label">
                Transfer / Transaction Quantity * {selectedProd ? `(${getUnitLabel(selectedProd.unit)})` : ''}
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="Enter quantity"
                className="input-field text-sm font-bold"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Challan / Vehicle No</label>
                <input
                  type="text"
                  placeholder="e.g. TRF-8891 or MH-12"
                  className="input-field text-xs"
                  value={challanNo}
                  onChange={e => setChallanNo(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Party / Transporter</label>
                <input
                  type="text"
                  placeholder="Driver / transporter name..."
                  className="input-field text-xs"
                  value={supplierCustomer}
                  onChange={e => setSupplierCustomer(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary py-2 text-xs font-bold"
              >
                Post Movement to Ledger
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  )
}
