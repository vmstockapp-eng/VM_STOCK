import React, { useState, useEffect, useCallback } from 'react'
import { Warehouse as WarehouseIcon, Plus, Edit, MapPin, Trash2, AlertCircle } from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { CardSkeleton } from '../../components/ui/LoadingSkeleton'
import {
  deleteWarehouseRecord,
  loadWarehouseStockRows,
  loadWarehouses,
  saveWarehouseRecord,
  type WarehouseStockRow
} from '../../lib/catalogService'
import { useToast } from '../../store/ToastContext'
import { formatNumber } from '../../lib/utils'
import type { Warehouse } from '../../types'
import { useAuth } from '../../store/AuthContext'

export default function AdminWarehouses() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const [warehousesList, setWarehousesList] = useState<Warehouse[]>([])
  const [balances, setBalances] = useState<WarehouseStockRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [isActive, setIsActive] = useState(true)

  const refreshWarehouses = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [warehouses, stockRows] = await Promise.all([loadWarehouses(), loadWarehouseStockRows()])
      setWarehousesList(warehouses)
      setBalances(stockRows)
      return true
    } catch (error) {
      setWarehousesList([])
      setBalances([])
      setLoadError(error instanceof Error ? error.message : 'Unable to load warehouses.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadWarehouses(), loadWarehouseStockRows()])
      .then(([warehouses, stockRows]) => {
        if (cancelled) return
        setWarehousesList(warehouses)
        setBalances(stockRows)
      })
      .catch(error => {
        if (cancelled) return
        setWarehousesList([])
        setBalances([])
        setLoadError(error instanceof Error ? error.message : 'Unable to load warehouses.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const openAddModal = () => {
    setEditingWh(null)
    setName('')
    setCode('')
    setCity('')
    setAddress('')
    setIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (wh: Warehouse) => {
    setEditingWh(wh)
    setName(wh.name)
    setCode(wh.code)
    setCity(wh.city || '')
    setAddress(wh.address || '')
    setIsActive(wh.is_active)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      toast('error', 'Missing Information', 'Warehouse name and short code are required.')
      return
    }

    setIsSaving(true)
    try {
      await saveWarehouseRecord({
        ...(editingWh ? { id: editingWh.id } : {}),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim() || null,
        address: address.trim() || null,
        is_active: isActive
      })

      setModalOpen(false)
      const refreshed = await refreshWarehouses()
      toast(
        refreshed ? 'success' : 'warning',
        refreshed ? (editingWh ? 'Warehouse Updated' : 'Warehouse Added') : 'Warehouse Saved; Refresh Failed',
        refreshed ? `${name} saved.` : `${name} was saved, but the list could not be refreshed. Reload the page.`
      )
    } catch (error) {
      toast('error', 'Failed to Save', error instanceof Error ? error.message : 'Database request failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!warehouseToDelete) return
    setIsSaving(true)
    setDeleteError(null)
    try {
      await deleteWarehouseRecord(warehouseToDelete.id)
      setWarehouseToDelete(null)
      const refreshed = await refreshWarehouses()
      toast(
        refreshed ? 'success' : 'warning',
        refreshed ? 'Warehouse Deleted' : 'Warehouse Deleted; Refresh Failed',
        refreshed ? `${warehouseToDelete.name} removed.` : 'The warehouse was deleted, but the list could not be refreshed. Reload the page.'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database request failed.'
      setDeleteError(message)
      toast('error', 'Failed to Delete Warehouse', message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout title="Warehouse & Godown Locations">
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-brand-textSecondary">
            Manage multi-location stock yards and godown transit checkpoints.
          </p>

          {canManage && (
            <button
              onClick={openAddModal}
              disabled={isLoading || isSaving}
              className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Godown Location
            </button>
          )}
        </div>

        {loadError && (
          <div role="alert" className="flex items-start justify-between gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
            <button type="button" onClick={() => void refreshWarehouses()} className="font-bold underline whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {!canManage && !isLoading && !loadError && (
          <p className="text-xs text-brand-textSecondary">You have read-only access to warehouses.</p>
        )}

        {/* Warehouses Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="md:col-span-2"><CardSkeleton /></div>
          ) : warehousesList.length === 0 ? (
            <div className="md:col-span-2 card border border-brand-border bg-white rounded-2xl shadow-card">
              <EmptyState
                icon={<WarehouseIcon className="w-7 h-7" />}
                title={loadError ? 'Warehouses unavailable' : 'No warehouses found'}
                description={loadError ? 'Retry the database request to load warehouses.' : 'Add a warehouse location to start organizing stock.'}
              />
            </div>
          ) : warehousesList.map(wh => {
            const whBalances = balances.filter(b => b.warehouse_id === wh.id)
            const totalUnits = whBalances.reduce((sum, b) => sum + b.quantity, 0)
            const activeSkus = whBalances.filter(b => b.quantity > 0).length

            return (
              <div
                key={wh.id}
                className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4 hover:border-teal-DEFAULT transition-all"
              >
                <div className="flex items-start justify-between pb-3 border-b border-brand-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-DEFAULT flex items-center justify-center font-bold text-sm">
                      {wh.code}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-navy-DEFAULT">{wh.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-brand-textSecondary mt-0.5">
                        <MapPin className="w-3 h-3 text-teal-DEFAULT" />
                        <span>{wh.city || 'City not set'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${wh.is_active ? 'badge-success' : 'badge-error'}`}>
                      {wh.is_active ? 'Active Yard' : 'Inactive'}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onClick={() => openEditModal(wh)}
                          disabled={isSaving}
                          className="p-1 text-brand-textSecondary hover:text-navy-DEFAULT rounded hover:bg-brand-bg disabled:opacity-50"
                          title="Edit Location"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteError(null); setWarehouseToDelete(wh) }}
                          disabled={isSaving}
                          className="p-1 text-brand-textSecondary hover:text-brand-error rounded hover:bg-red-50 disabled:opacity-50"
                          title="Delete Location"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {wh.address && (
                  <p className="text-xs text-brand-textSecondary bg-brand-bg p-2.5 rounded-xl border border-brand-border/60">
                    {wh.address}
                  </p>
                )}

                {/* Stock Summary for Location */}
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="bg-teal-50/50 p-3 rounded-xl border border-teal-100">
                    <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Total Stock Units</span>
                    <span className="text-base font-extrabold text-navy-DEFAULT mt-0.5 block">
                      {formatNumber(totalUnits)}
                    </span>
                  </div>

                  <div className="bg-brand-bg p-3 rounded-xl border border-brand-border">
                    <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Active SKUs Stored</span>
                    <span className="text-base font-extrabold text-teal-DEFAULT mt-0.5 block">
                      {activeSkus} SKUs
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal: Add / Edit Warehouse */}
        {canManage && <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingWh ? `Edit Warehouse: ${editingWh.code}` : 'Add Godown Location'}
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Location Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GD1, GD2, MO"
                  className="input-field text-xs font-bold uppercase"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="label">City / Region</label>
                <input
                  type="text"
                  placeholder="e.g. Pune, Nigdi, Wagholi"
                  className="input-field text-xs"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Warehouse / Godown Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Godown 1 (North Yard)"
                className="input-field text-xs"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Complete Yard Address</label>
              <textarea
                rows={2}
                placeholder="Plot / Gat number, road, landmark, pincode..."
                className="input-field text-xs resize-none"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="wh_active"
                className="rounded border-brand-border text-teal-DEFAULT focus:ring-teal-DEFAULT"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              <label htmlFor="wh_active" className="text-xs font-semibold text-navy-DEFAULT cursor-pointer">
                Warehouse is active and enabled for stock movement transfers
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSaving}
                className="btn-secondary py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="btn-primary py-2 text-xs font-bold disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save Warehouse'}
              </button>
            </div>
          </form>
        </Modal>}

        <ConfirmDialog
          open={Boolean(warehouseToDelete)}
          onClose={() => setWarehouseToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Warehouse?"
          message={deleteError || `Delete "${warehouseToDelete?.name}"? It cannot be removed while stock or operational records reference it.`}
          confirmLabel="Delete Warehouse"
          danger
          loading={isSaving}
        />
      </div>
    </AdminLayout>
  )
}
