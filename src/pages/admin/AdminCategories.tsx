import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Tag, Plus, Edit, Trash2, Search, AlertCircle } from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { TableSkeleton } from '../../components/ui/LoadingSkeleton'
import { deleteCategoryRecord, loadCategories, loadProducts, saveCategoryRecord } from '../../lib/catalogService'
import { useToast } from '../../store/ToastContext'
import type { Category } from '../../types'
import { useAuth } from '../../store/AuthContext'

export default function AdminCategories() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const [categoriesList, setCategoriesList] = useState<Category[]>([])
  const [productsCountByCategory, setProductsCountByCategory] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('1')
  const [isActive, setIsActive] = useState(true)

  const refreshCategories = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [categories, products] = await Promise.all([loadCategories(), loadProducts()])
      setCategoriesList(categories)
      setProductsCountByCategory(products.reduce<Record<string, number>>((counts, product) => {
        if (product.is_active) counts[product.category_id] = (counts[product.category_id] || 0) + 1
        return counts
      }, {}))
      return true
    } catch (error) {
      setCategoriesList([])
      setProductsCountByCategory({})
      setLoadError(error instanceof Error ? error.message : 'Unable to load categories.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCategories(), loadProducts()])
      .then(([categories, products]) => {
        if (cancelled) return
        setCategoriesList(categories)
        setProductsCountByCategory(products.reduce<Record<string, number>>((counts, product) => {
          if (product.is_active) counts[product.category_id] = (counts[product.category_id] || 0) + 1
          return counts
        }, {}))
      })
      .catch(error => {
        if (cancelled) return
        setCategoriesList([])
        setProductsCountByCategory({})
        setLoadError(error instanceof Error ? error.message : 'Unable to load categories.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filteredCategories = useMemo(() => {
    return categoriesList.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    )
  }, [categoriesList, search])

  const openAddModal = () => {
    setEditingCat(null)
    setName('')
    setCode('')
    setDescription('')
    setSortOrder(String(categoriesList.length + 1))
    setIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (cat: Category) => {
    setEditingCat(cat)
    setName(cat.name)
    setCode(cat.code)
    setDescription(cat.description || '')
    setSortOrder(String(cat.sort_order))
    setIsActive(cat.is_active)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) {
      toast('error', 'Missing Information', 'Category name and code are required.')
      return
    }

    const parsedSortOrder = Number(sortOrder)
    if (!Number.isInteger(parsedSortOrder) || parsedSortOrder < 1) {
      toast('error', 'Invalid Sort Order', 'Display order must be a positive whole number.')
      return
    }

    setIsSaving(true)
    try {
      await saveCategoryRecord({
        ...(editingCat ? { id: editingCat.id } : {}),
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        sort_order: parsedSortOrder,
        is_active: isActive
      })

      setModalOpen(false)
      const refreshed = await refreshCategories()
      toast(
        refreshed ? 'success' : 'warning',
        refreshed ? (editingCat ? 'Category Updated' : 'Category Created') : 'Category Saved; Refresh Failed',
        refreshed ? `${name} saved.` : `${name} was saved, but the list could not be refreshed. Reload the page.`
      )
    } catch (error) {
      toast('error', 'Failed to Save', error instanceof Error ? error.message : 'Database request failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!categoryToDelete) return
    setIsSaving(true)
    setDeleteError(null)
    try {
      await deleteCategoryRecord(categoryToDelete.id)
      setCategoryToDelete(null)
      const refreshed = await refreshCategories()
      toast(
        refreshed ? 'success' : 'warning',
        refreshed ? 'Category Deleted' : 'Category Deleted; Refresh Failed',
        refreshed ? `${categoryToDelete.name} removed.` : 'The category was deleted, but the list could not be refreshed. Reload the page.'
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database request failed.'
      setDeleteError(message)
      toast('error', 'Failed to Delete Category', message)
    } finally {
      setIsSaving(false)
    }
  }
  return (
    <AdminLayout title="Product Category Master">
      <div className="space-y-4">
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
              className="input-field pl-9 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {canManage && (
            <button
              onClick={openAddModal}
              disabled={isLoading || isSaving}
              className="btn-primary py-2 px-3 text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>

        {loadError && (
          <div role="alert" className="flex items-start justify-between gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
            <button type="button" onClick={() => void refreshCategories()} className="font-bold underline whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {!canManage && !isLoading && !loadError && (
          <p className="text-xs text-brand-textSecondary">You have read-only access to categories.</p>
        )}

        {/* Categories Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center">Active Products</th>
                <th className="py-3 px-4 text-center">Display Order</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {isLoading ? (
                <tr><td colSpan={7} className="p-4"><TableSkeleton rows={4} cols={7} /></td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<Tag className="w-7 h-7" />}
                      title={loadError ? 'Categories unavailable' : 'No categories found'}
                      description={loadError ? 'Retry the database request to load categories.' : 'Add a product category to organize your catalog.'}
                    />
                  </td>
                </tr>
              ) : filteredCategories.map(cat => {
                const count = productsCountByCategory[cat.id] || 0
                return (
                  <tr key={cat.id} className="hover:bg-brand-bg/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-navy-DEFAULT">
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-DEFAULT border border-teal-100">
                        {cat.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-brand-textPrimary">
                      {cat.name}
                    </td>
                    <td className="py-3 px-4 text-brand-textSecondary max-w-xs truncate">
                      {cat.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-navy-DEFAULT">
                      {count} SKUs
                    </td>
                    <td className="py-3 px-4 text-center text-brand-textSecondary font-medium">
                      #{cat.sort_order}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cat.is_active ? 'badge-success' : 'badge-error'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEditModal(cat)}
                            disabled={isSaving}
                            className="p-1 text-brand-textSecondary hover:text-navy-DEFAULT rounded hover:bg-brand-bg disabled:opacity-50"
                            title="Edit Category"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeleteError(null); setCategoryToDelete(cat) }}
                            disabled={isSaving}
                            className="p-1 text-brand-textSecondary hover:text-brand-error rounded hover:bg-red-50 disabled:opacity-50"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Modal: Add / Edit Category */}
        {canManage && <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingCat ? `Edit Category: ${editingCat.name}` : 'Add Product Category'}
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PVC, HDPE"
                  className="input-field text-xs font-bold uppercase"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="label">Display Sort Order</label>
                <input
                  type="number"
                  min="1"
                  className="input-field text-xs"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Category Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. PVC Pipes & Fittings"
                className="input-field text-xs"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Description / Scope</label>
              <textarea
                rows={2}
                placeholder="Product types included under this category..."
                className="input-field text-xs resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="cat_active"
                className="rounded border-brand-border text-teal-DEFAULT focus:ring-teal-DEFAULT"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              <label htmlFor="cat_active" className="text-xs font-semibold text-navy-DEFAULT cursor-pointer">
                Category is active and selectable in staff stock entry forms
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
                {isSaving ? 'Saving…' : 'Save Category'}
              </button>
            </div>
          </form>
        </Modal>}

        <ConfirmDialog
          open={Boolean(categoryToDelete)}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Category?"
          message={deleteError || `Delete "${categoryToDelete?.name}"? It cannot be removed while products, pricing rules, or history records reference it.`}
          confirmLabel="Delete Category"
          danger
          loading={isSaving}
        />
      </div>
    </AdminLayout>
  )
}
