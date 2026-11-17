import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Plus, Search, Download, Upload, Edit, Trash2,
  ChevronLeft, ChevronRight, Info, AlertCircle
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { TableSkeleton } from '../../components/ui/LoadingSkeleton'
import {
  deleteProductRecord,
  importProductsToSupabase,
  loadCategories,
  loadProducts,
  saveProductRecord
} from '../../lib/catalogService'
import { useToast } from '../../store/ToastContext'
import { useAuth } from '../../store/AuthContext'
import { formatCurrency, formatNumber, getUnitLabel } from '../../lib/utils'
import type { Category, Product, ProductUnit } from '../../types'
import Papa from 'papaparse'

function csvCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null) return String(value).trim()
  }
  return ''
}

export default function AdminProducts() {
  const { toast } = useToast()
  const { profile } = useAuth()
  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const [categories, setCategories] = useState<Category[]>([])
  const [productsList, setProductsList] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // CSV Import State
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [isProcessingImport, setIsProcessingImport] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form Fields
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [grade, setGrade] = useState('')
  const [diameterMm, setDiameterMm] = useState('')
  const [pressureRatingKg, setPressureRatingKg] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [coilLengthM, setCoilLengthM] = useState('')
  const [unit, setUnit] = useState<ProductUnit>('piece')
  const [rate, setRate] = useState('')
  const [gstPercent, setGstPercent] = useState('18')
  const [minStock, setMinStock] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const refreshCatalog = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [loadedCategories, loadedProducts] = await Promise.all([
        loadCategories(),
        loadProducts()
      ])
      setCategories(loadedCategories)
      setProductsList(loadedProducts)
      return true
    } catch (error) {
      setCategories([])
      setProductsList([])
      setLoadError(error instanceof Error ? error.message : 'Unable to load the product catalog.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadCategories(), loadProducts()])
      .then(([loadedCategories, loadedProducts]) => {
        if (cancelled) return
        setCategories(loadedCategories)
        setProductsList(loadedProducts)
      })
      .catch(error => {
        if (cancelled) return
        setCategories([])
        setProductsList([])
        setLoadError(error instanceof Error ? error.message : 'Unable to load the product catalog.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Filtered List
  
const filteredProducts = useMemo(() => {
  const query = search.trim().toLowerCase()

  return productsList.filter((product) => {
    const category = categories.find(
      (item) => item.id === product.category_id
    )

    const searchableText = [
      product.sku,
      product.name,
      product.grade ?? '',
      product.diameter_mm ?? '',
      product.pressure_rating_kg ?? '',
      category?.name ?? '',
    ]
      .join(' ')
      .toLowerCase()

    const matchesSearch =
      !query || searchableText.includes(query)

    const matchesCategory =
      categoryFilter === 'all' ||
      product.category_id === categoryFilter

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && product.is_active) ||
      (statusFilter === 'inactive' && !product.is_active)

    return matchesSearch && matchesCategory && matchesStatus
  })
}, [productsList, categories, search, categoryFilter, statusFilter])


  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, page])

  const openAddModal = () => {
    setEditingProduct(null)
    setSku('')
    setName('')
    setCategoryId(categories[0]?.id || '')
    setGrade('')
    setDiameterMm('')
    setPressureRatingKg('')
    setWeightKg('')
    setCoilLengthM('')
    setUnit('piece')
    setRate('')
    setGstPercent('18')
    setMinStock('')
    setNotes('')
    setIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (p: Product) => {
    setEditingProduct(p)
    setSku(p.sku)
    setName(p.name)
    setCategoryId(p.category_id)
    setGrade(p.grade || '')
    setDiameterMm(p.diameter_mm ? String(p.diameter_mm) : '')
    setPressureRatingKg(p.pressure_rating_kg ? String(p.pressure_rating_kg) : '')
    setWeightKg(p.weight_kg ? String(p.weight_kg) : '')
    setCoilLengthM(p.coil_length_m ? String(p.coil_length_m) : '')
    setUnit(p.unit)
    setRate(String(p.rate))
    setGstPercent(String(p.gst_percent))
    setMinStock(p.min_stock_threshold ? String(p.min_stock_threshold) : '')
    setNotes(p.notes || '')
    setIsActive(p.is_active)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedRate = Number(rate)
    const parsedGst = Number(gstPercent)
    if (!sku.trim() || !name.trim() || !rate || !categoryId) {
      toast('error', 'Missing Fields', 'SKU, Product Name and Standard Rate are required.')
      return
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || !Number.isFinite(parsedGst) || parsedGst < 0) {
      toast('error', 'Invalid Values', 'Rate and GST must be valid non-negative numbers.')
      return
    }

    setIsSaving(true)
    try {
      const saved = await saveProductRecord({
        ...(editingProduct ? { id: editingProduct.id } : {}),
        sku: sku.trim(),
        name: name.trim(),
        category_id: categoryId,
        grade: grade.trim() || null,
        diameter_mm: diameterMm ? Number(diameterMm) : null,
        pressure_rating_kg: pressureRatingKg ? Number(pressureRatingKg) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        coil_length_m: coilLengthM ? Number(coilLengthM) : null,
        unit: unit,
        rate: parsedRate,
        gst_percent: parsedGst,
        min_stock_threshold: minStock ? Number(minStock) : null,
        is_active: isActive,
        notes: notes.trim() || null,
        image_url: editingProduct?.image_url ?? null
      })

      setModalOpen(false)
      const refreshed = await refreshCatalog()
      toast(
        refreshed ? 'success' : 'warning',
        refreshed ? (editingProduct ? 'Product Updated' : 'Product Created') : 'Product Saved; Refresh Failed',
        refreshed ? `${saved.sku} saved successfully.` : `${saved.sku} was saved, but the list could not be refreshed. Reload the page.`
      )
    } catch (error) {
      toast('error', 'Failed to save product', error instanceof Error ? error.message : 'Database request failed.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!productToDelete) return

    const target = productToDelete
    setIsSaving(true)
    setDeleteError(null)

    try {
      // The database RPC permanently deletes an unreferenced product, but
      // deactivates a product that is referenced by stock/history records.
      await deleteProductRecord(target.id)

      // Reload the authoritative catalog so the UI can distinguish those outcomes.
      const latestProducts = await loadProducts()
      setProductsList(latestProducts)
      setPage(1)
      setDeleteConfirmOpen(false)
      setProductToDelete(null)

      const remainingProduct = latestProducts.find(product => product.id === target.id)

      if (!remainingProduct) {
        toast('success', 'Product Deleted', `${target.sku} was permanently removed from the catalog.`)
      } else if (!remainingProduct.is_active) {
        toast(
          'success',
          'Product Deactivated',
          `${target.sku} has stock or historical records, so it was marked inactive. Existing inventory history was preserved.`
        )
      } else {
        toast(
          'warning',
          'Product Still Exists',
          `${target.sku} is still in the catalog. Refresh the page and check the database function result.`
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database request failed.'
      setDeleteError(message)
      toast('error', 'Product Action Failed', message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportCSV = () => {
    const exportData = filteredProducts.map(p => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category?.name || '',
      Unit: p.unit,
      Rate_INR: p.rate,
      GST_Percent: p.gst_percent,
      Grade: p.grade || '',
      Diameter_mm: p.diameter_mm || '',
      Pressure_Rating_kg: p.pressure_rating_kg || '',
      Coil_Length_m: p.coil_length_m || '',
      Min_Stock_Threshold: p.min_stock_threshold || '',
      Status: p.is_active ? 'Active' : 'Inactive'
    }))

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `StockFlow_Products_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('success', 'Export Ready', 'Product master exported to CSV.')
  }

  // CSV Import Handlers
  const handleOpenImportModal = () => {
    setImportFile(null)
    setPreviewRows([])
    setImportErrors([])
    setDuplicateStrategy('update')
    setImportModalOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setImportErrors([])

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setImportErrors(['The selected CSV file is empty or missing headers.'])
          setPreviewRows([])
          return
        }

        const data = results.data
        const firstRow = data[0]
        const keys = Object.keys(firstRow).map(k => k.trim().toLowerCase())
        const hasSku = keys.some(k => k.includes('sku') || k.includes('code') || k.includes('id'))
        const hasName = keys.some(k => k.includes('name') || k.includes('item') || k.includes('desc'))

        if (!hasSku || !hasName) {
          setImportErrors([
            `CSV must contain at least "SKU" and "Name" columns. Found headers: ${Object.keys(firstRow).join(', ')}`
          ])
        }

        setPreviewRows(data)
      },
      error: (err) => {
        setImportErrors([`Failed to read CSV: ${err.message}`])
        setPreviewRows([])
      }
    })
  }

  const previewStats = useMemo(() => {
    let newCount = 0
    let updateCount = 0
    let invalidCount = 0

    const currentSkus = new Set(productsList.map(p => p.sku.toUpperCase()))

    for (const raw of previewRows) {
      const sku = csvCell(raw, 'SKU', 'sku', 'Item_Code', 'ItemCode', 'Product SKU').toUpperCase()
      const name = csvCell(raw, 'Name', 'name', 'Product_Name', 'Product Name')

      if (!sku || !name) {
        invalidCount++
      } else if (currentSkus.has(sku)) {
        updateCount++
      } else {
        newCount++
      }
    }

    return { total: previewRows.length, newCount, updateCount, invalidCount }
  }, [previewRows, productsList])

  const handleRunImport = async () => {
    if (previewRows.length === 0) {
      toast('warning', 'No Products Found', 'Please upload a CSV file with valid product rows.')
      return
    }

    setIsProcessingImport(true)
    try {
      const res = await importProductsToSupabase(previewRows, categories, productsList, duplicateStrategy)
      const refreshed = await refreshCatalog()
      setImportModalOpen(false)

      if (res.failed > 0) {
        toast(
          'warning',
          'Import Completed with Warnings',
          `Processed ${res.total_processed} rows: ${res.created} created, ${res.updated} updated, ${res.skipped} skipped, ${res.failed} invalid rows.`
        )
      } else {
        toast(
          'success',
          'Products Imported Successfully',
          `Successfully imported all ${res.created + res.updated} products (${res.created} new, ${res.updated} updated, ${res.skipped} skipped).`
        )
      }
      if (!refreshed) {
        toast('warning', 'Import Saved; Refresh Failed', 'The import completed, but the product list could not be refreshed. Reload the page.')
      }
    } catch (error) {
      toast('error', 'Import Failed', error instanceof Error ? error.message : 'Database request failed.')
    } finally {
      setIsProcessingImport(false)
    }
  }

  return (
    <AdminLayout title="Product Master (SKU Catalog)">
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search & Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by SKU or Product Name..."
                className="input-field pl-9 text-xs"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <select
              className="input-field text-xs w-36"
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="input-field text-xs w-28"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-teal-DEFAULT" /> Export CSV
            </button>
            {canManage && (
              <>
                <button
                  onClick={handleOpenImportModal}
                  disabled={isLoading || isSaving || categories.length === 0}
                  className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 border-[#0D827D] text-[#0D827D] hover:bg-[#E7F3F1]"
                >
                  <Upload className="w-4 h-4" /> Import Products CSV
                </button>
                <button
                  onClick={openAddModal}
                  disabled={isLoading || isSaving || categories.length === 0}
                  title={categories.length === 0 ? 'Add a category before creating products.' : undefined}
                  className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Product SKU
                </button>
              </>
            )}
          </div>
        </div>

        {loadError && (
          <div role="alert" className="flex items-start justify-between gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
            <button type="button" onClick={() => void refreshCatalog()} className="font-bold underline whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !loadError && categories.length === 0 && (
          <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            Create a category before adding or importing products.
          </div>
        )}
        {!canManage && !isLoading && !loadError && (
          <p className="text-xs text-brand-textSecondary">You have read-only access to products.</p>
        )}

        {/* Products Table Card */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-3 px-4">SKU / Code</th>
                  <th className="py-3 px-4">Product Name & Specs</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Standard Rate</th>
                  <th className="py-3 px-4 text-center">GST %</th>
                  <th className="py-3 px-4 text-right">Min Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {isLoading ? (
                  <tr><td colSpan={9} className="p-4"><TableSkeleton rows={4} cols={9} /></td></tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-brand-textSecondary">
                      {loadError ? 'Product records are unavailable until the database request succeeds.' : 'No matching products found.'}
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map(p => (
                    <tr key={p.id} className="hover:bg-brand-bg/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-navy-DEFAULT">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-brand-textPrimary block">{p.name}</span>
                        <span className="text-[10px] text-brand-textSecondary">
                          {p.grade ? `Grade: ${p.grade}` : ''}
                          {p.diameter_mm ? ` • ${p.diameter_mm}mm` : ''}
                          {p.pressure_rating_kg ? ` • ${p.pressure_rating_kg}kg` : ''}
                          {p.coil_length_m ? ` • ${p.coil_length_m}m coil` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-teal-DEFAULT bg-teal-50 px-2 py-0.5 rounded-full text-[10px]">
                          {p.category?.name || 'Category'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-brand-textSecondary capitalize">
                        {getUnitLabel(p.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-navy-DEFAULT">
                        {formatCurrency(p.rate)}
                      </td>
                      <td className="py-3 px-4 text-center text-brand-textSecondary">
                        {p.gst_percent}%
                      </td>
                      <td className="py-3 px-4 text-right text-brand-textPrimary font-semibold">
                        {p.min_stock_threshold ? `${formatNumber(p.min_stock_threshold)} ${getUnitLabel(p.unit)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.is_active ? 'badge-success' : 'badge-error'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="p-1 text-brand-textSecondary hover:text-navy-DEFAULT rounded hover:bg-brand-bg"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setProductToDelete(p); setDeleteConfirmOpen(true) }}
                            title="Delete Product"
                            className="p-1 text-brand-textSecondary hover:text-brand-error rounded hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3 border-t border-brand-border flex items-center justify-between text-xs text-brand-textSecondary">
            <span>
              Showing {filteredProducts.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, filteredProducts.length)} of {filteredProducts.length} Products
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1 rounded border border-brand-border hover:bg-brand-bg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">Page {page} of {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded border border-brand-border hover:bg-brand-bg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal: Add / Edit Product */}
        {canManage && <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingProduct ? `Edit Product: ${editingProduct.sku}` : 'Add New Product SKU'}
          size="lg"
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">SKU / Product Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PVC-63-4"
                  className="input-field text-xs font-bold"
                  value={sku}
                  onChange={e => setSku(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Product Category *</label>
                <select
                  required
                  disabled={categories.length === 0 || isSaving}
                  className="input-field text-xs font-medium"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Full Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. PVC Pipe 63 mm × 4 kg/cm²"
                className="input-field text-xs"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            {/* Technical Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className="label">Grade / Class</label>
                <input
                  type="text"
                  placeholder="e.g. PE80, Class 2"
                  className="input-field text-xs"
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Diameter (mm)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 63"
                  className="input-field text-xs"
                  value={diameterMm}
                  onChange={e => setDiameterMm(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Pressure Rating (kg)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 4 or 8"
                  className="input-field text-xs"
                  value={pressureRatingKg}
                  onChange={e => setPressureRatingKg(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Coil Length (m)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 500"
                  className="input-field text-xs"
                  value={coilLengthM}
                  onChange={e => setCoilLengthM(e.target.value)}
                />
              </div>
            </div>

            {/* Commercial Terms: Unit, Rate, GST, Min Stock */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div>
                <label className="label">Measurement Unit *</label>
                <select
                  className="input-field text-xs font-semibold capitalize"
                  value={unit}
                  onChange={e => setUnit(e.target.value as ProductUnit)}
                >
                  <option value="piece">Piece (Pcs)</option>
                  <option value="coil">Coil</option>
                  <option value="metre">Metre (Mtr)</option>
                  <option value="tank">Tank</option>
                  <option value="box">Box</option>
                  <option value="kg">Kilogram (Kg)</option>
                  <option value="litre">Litre (Ltr)</option>
                </select>
              </div>

              <div>
                <label className="label">Standard Rate (₹) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 460"
                  className="input-field text-xs font-bold"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">GST Rate (%)</label>
                <input
                  type="number"
                  step="any"
                  className="input-field text-xs"
                  value={gstPercent}
                  onChange={e => setGstPercent(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Min Stock Threshold</label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 500"
                  className="input-field text-xs"
                  value={minStock}
                  onChange={e => setMinStock(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Notes / Description</label>
              <textarea
                rows={2}
                placeholder="Product packaging specs, warranty, vendor info..."
                className="input-field text-xs resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active_check"
                className="rounded border-brand-border text-teal-DEFAULT focus:ring-teal-DEFAULT"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
              <label htmlFor="is_active_check" className="text-xs font-semibold text-navy-DEFAULT cursor-pointer">
                Product is active and visible in staff daily stock forms
              </label>
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
                disabled={isSaving || isLoading || categories.length === 0}
                className="btn-primary py-2 text-xs font-bold"
              >
                {isSaving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Create Product SKU'}
              </button>
            </div>
          </form>
        </Modal>}

        {/* Delete Confirmation */}
        {canManage && <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
          title="Delete Product SKU?"
          message={deleteError
            ? deleteError
            : `Remove "${productToDelete?.name}" (${productToDelete?.sku}) from the catalog? If stock or historical records reference this product, it will be deactivated instead of permanently deleted so inventory history is preserved.`}
          danger
          confirmLabel="Delete SKU"
          loading={isSaving}
        />}

        {/* CSV Import Modal */}
        {canManage && <Modal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Import Products from CSV"
          size="xl"
        >
          <div className="space-y-4">
            {/* Top Instructions & Template Box */}
            <div className="p-3.5 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#0D827D] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#102C42]">Upload Products Spreadsheet (.CSV)</p>
                  <p className="text-[11px] text-[#72869A]">
                    Supports PVC Pipes, HDPE Coils, SWR Pipes, CPVC, Fittings, and Water Tanks with sizes, rates, and units.
                  </p>
                </div>
              </div>
              <a
                href="/sample_products.csv"
                download="StockFlow_Products_Template.csv"
                className="btn-secondary py-1.5 px-3 text-[11px] whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 text-[#0D827D] border-[#0D827D]/40"
              >
                <Download className="w-3.5 h-3.5" /> Download Template CSV
              </a>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-[#DCE5EB] hover:border-[#0D827D] transition-colors rounded-2xl p-5 text-center bg-white">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVFileChange}
                className="hidden"
                id="product-csv-upload-input"
              />
              <label
                htmlFor="product-csv-upload-input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#E7F3F1] text-[#0D827D] flex items-center justify-center shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#102C42]">
                    {importFile ? importFile.name : 'Click to select CSV file from your computer'}
                  </p>
                  <p className="text-[11px] text-[#72869A]">
                    {importFile ? `${(importFile.size / 1024).toFixed(1)} KB • Click to choose different file` : 'CSV format with SKU, Name, Category, Unit, Rate_INR'}
                  </p>
                </div>
              </label>
            </div>

            {/* Parsing Errors Banner */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <span>Validation Errors Detected</span>
                </div>
                {importErrors.map((err, i) => (
                  <p key={i} className="text-[11px] text-red-600 pl-5">• {err}</p>
                ))}
              </div>
            )}

            {/* Preview & Stats Section */}
            {previewRows.length > 0 && (
              <div className="space-y-3">
                {/* Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F4F7FA] border border-[#DCE5EB]">
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Total Rows</span>
                    <strong className="text-base text-[#102C42]">{previewStats.total}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-[#16845B]">
                    <span className="text-[10px] uppercase font-bold block">New SKUs</span>
                    <strong className="text-base">{previewStats.newCount}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#102C42]">
                    <span className="text-[10px] uppercase font-bold block">Existing SKUs</span>
                    <strong className="text-base">{previewStats.updateCount}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="text-[10px] uppercase font-bold block">Invalid Rows</span>
                    <strong className="text-base">{previewStats.invalidCount}</strong>
                  </div>
                </div>

                {/* Duplicate Strategy Option */}
                <div className="p-3.5 bg-white rounded-xl border border-[#DCE5EB] space-y-2 text-xs">
                  <label className="font-bold text-[#102C42] block">Duplicate SKU Handling Option:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 ${duplicateStrategy === 'update' ? 'border-[#0D827D] bg-[#E7F3F1]/40' : 'border-[#DCE5EB]'}`}>
                      <input
                        type="radio"
                        name="dup_strat"
                        value="update"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="mt-0.5 text-[#0D827D] focus:ring-[#0D827D]"
                      />
                      <div>
                        <strong className="block text-[#102C42]">Update matching products</strong>
                        <span className="text-[11px] text-[#72869A]">Update rates, specs, and details from CSV. Preserves stock balances.</span>
                      </div>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 ${duplicateStrategy === 'skip' ? 'border-[#0D827D] bg-[#E7F3F1]/40' : 'border-[#DCE5EB]'}`}>
                      <input
                        type="radio"
                        name="dup_strat"
                        value="skip"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="mt-0.5 text-[#0D827D] focus:ring-[#0D827D]"
                      />
                      <div>
                        <strong className="block text-[#102C42]">Skip existing products</strong>
                        <span className="text-[11px] text-[#72869A]">Only import new SKUs that don't already exist in the catalog.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Scrollable Preview Table */}
                <div className="border border-[#DCE5EB] rounded-xl overflow-hidden">
                  <div className="bg-[#F4F7FA] px-3 py-2 border-b border-[#DCE5EB] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#102C42]">Data Preview ({previewRows.length} rows to import)</span>
                    <span className="text-[11px] text-[#72869A]">All valid products will be saved to database</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-[#F4F7FA] text-[#72869A] text-[10px] uppercase font-bold sticky top-0 border-b border-[#DCE5EB]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Unit</th>
                          <th className="py-2 px-3 text-right">Rate (₹)</th>
                          <th className="py-2 px-3 text-center">Import Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE5EB]">
                        {previewRows.map((r, idx) => {
                          const sku = csvCell(r, 'SKU', 'sku', 'Item_Code', 'ItemCode', 'Product SKU').toUpperCase()
                          const name = csvCell(r, 'Name', 'name', 'Product_Name', 'Product Name')
                          const cat = csvCell(r, 'Category', 'category') || '—'
                          const unit = csvCell(r, 'Unit', 'unit') || 'piece'
                          const rate = csvCell(r, 'Rate_INR', 'rate', 'Rate') || '0'

                          const exists = productsList.some(p => p.sku.toUpperCase() === sku)
                          const isValid = Boolean(sku && name)

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 text-[#72869A]">{idx + 1}</td>
                              <td className="py-2 px-3 font-mono font-bold text-[#102C42]">{sku || '—'}</td>
                              <td className="py-2 px-3 font-semibold text-[#102C42] max-w-xs truncate">{name || '—'}</td>
                              <td className="py-2 px-3 text-[#72869A]">{cat}</td>
                              <td className="py-2 px-3 text-[#72869A]">{unit}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[#102C42]">
                                {Number(rate) > 0 ? `₹${Number(rate).toFixed(2)}` : 'Pending'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {!isValid ? (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                    Invalid Row
                                  </span>
                                ) : exists ? (
                                  duplicateStrategy === 'update' ? (
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                      Will Update
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                      Will Skip
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-bold text-[#16845B] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                    New Product
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE5EB]">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunImport}
                disabled={previewRows.length === 0 || isProcessingImport}
                className="btn-primary py-2 px-5 text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {isProcessingImport
                  ? 'Importing Products...'
                  : `Confirm & Import All ${previewRows.length} Products`}
              </button>
            </div>
          </div>
        </Modal>}
      </div>
    </AdminLayout>
  )
}
