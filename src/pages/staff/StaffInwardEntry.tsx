import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDownLeft, Package, Calendar, Warehouse as WarehouseIcon,
  Plus, Trash2, CheckCircle2, AlertCircle, Clock, ChevronRight,
  ArrowLeft, Save, Send, Tag, Layers, FileText, X
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getCategories, getProducts, getWarehouses,
  saveInwardEntry, getProductStockBalance,
  getInwardEntryById, getInwardDrafts, deleteInwardDraft, hydrateCatalogCacheFromSupabase
} from '../../lib/dataService'
import type { Category, Product, InwardStockLine, InwardStockEntry } from '../../types'
import { generateRef, formatNumber, getUnitLabel } from '../../lib/utils'
import { persistInwardEntry } from '../../lib/staffTransactionService'

export default function StaffInwardEntry() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const draftParam = searchParams.get('draftId') || searchParams.get('ref')

  const warehouses = useMemo(() => getWarehouses(), [])
  const categories = useMemo(() => getCategories().filter(c => c.is_active), [])
  const allProducts = useMemo(() => getProducts().filter(p => p.is_active), [])

  const defaultWhId = profile?.warehouse_id || warehouses[1]?.id || 'w-2'
  const [warehouseId, setWarehouseId] = useState<string>(defaultWhId)
  const activeWarehouse = warehouses.find(w => w.id === warehouseId) || warehouses[0]

  // Inward Reference & Details
  const [referenceNo, setReferenceNo] = useState<string>(() => draftParam || generateRef('INW'))
  const [isDraftMode, setIsDraftMode] = useState<boolean>(Boolean(draftParam))
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [challanNo, setChallanNo] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [notes, setNotes] = useState('')

  // Multi-Category Sections: list of selected category IDs
  const [activeCategorySections, setActiveCategorySections] = useState<string[]>(() => {
    return categories.length > 0 ? [categories[0].id] : []
  })

  // Quantities map: [productId] -> quantity string
  const [quantities, setQuantities] = useState<Record<string, string>>({})

  // Saving states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedSuccessRef, setSavedSuccessRef] = useState<string | null>(null)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [draftsVersion, setDraftsVersion] = useState(0)

  // Current stock balances for active warehouse
  const stockBalanceMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of allProducts) {
      map[p.id] = getProductStockBalance(p.id, warehouseId)
    }
    return map
  }, [allProducts, warehouseId])

  // Available drafts
  const inwardDrafts = useMemo(() => {
    return getInwardDrafts(warehouseId)
  }, [warehouseId, draftsVersion])

  // Load draft if draftParam is present
  useEffect(() => {
    if (draftParam) {
      const draft = getInwardEntryById(draftParam)
      if (draft) {
        setReferenceNo(draft.reference_no)
        setIsDraftMode(true)
        setWarehouseId(draft.warehouse_id)
        setEntryDate(draft.entry_date)
        setChallanNo(draft.challan_no && draft.challan_no !== 'DRAFT-CHALLAN' ? draft.challan_no : '')
        setSupplierName(draft.supplier_name && draft.supplier_name !== 'Factory Receipt' ? draft.supplier_name : '')
        setNotes(draft.notes || '')

        // Populate quantities
        const qtyMap: Record<string, string> = {}
        const catIds = new Set<string>()
        for (const line of draft.lines) {
          if (line.quantity > 0) {
            qtyMap[line.product_id] = String(line.quantity)
            const prod = allProducts.find(p => p.id === line.product_id)
            if (prod) catIds.add(prod.category_id)
          }
        }
        setQuantities(qtyMap)
        if (catIds.size > 0) {
          setActiveCategorySections(Array.from(catIds))
        }
      }
    }
  }, [draftParam, allProducts])

  // Add another category section
  const handleAddCategorySection = () => {
    const unusedCat = categories.find(c => !activeCategorySections.includes(c.id))
    if (!unusedCat) {
      toast('info', 'All Categories Added', 'All active product categories are already displayed below.')
      return
    }
    setActiveCategorySections(prev => [...prev, unusedCat.id])
  }

  const handleRemoveCategorySection = (catId: string) => {
    if (activeCategorySections.length <= 1) {
      toast('info', 'Minimum 1 Category', 'At least one category section must remain visible.')
      return
    }
    setActiveCategorySections(prev => prev.filter(id => id !== catId))
  }

  const handleCategoryChange = (sectionIndex: number, newCatId: string) => {
    setActiveCategorySections(prev => {
      const copy = [...prev]
      copy[sectionIndex] = newCatId
      return copy
    })
  }

  const handleQtyChange = (productId: string, val: string) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: val
    }))
  }

  const handleResumeDraft = (draft: InwardStockEntry) => {
    setSearchParams({ draftId: draft.reference_no })
    setShowDraftsModal(false)
  }

  const handleDeleteDraft = (e: React.MouseEvent, draftRef: string) => {
    e.stopPropagation()
    deleteInwardDraft(draftRef)
    setDraftsVersion(v => v + 1)
    toast('info', 'Draft Removed', `Draft ${draftRef} deleted.`)
    if (referenceNo === draftRef) {
      setReferenceNo(generateRef('INW'))
      setIsDraftMode(false)
      setSearchParams({})
    }
  }

  const validateAndSubmit = async (isDraft: boolean) => {
    if (!profile) return

    if (!isDraft) {
      if (!challanNo.trim()) {
        toast('error', 'Missing Challan / Invoice', 'Please enter the Challan or Invoice Number.')
        return
      }
      if (!supplierName.trim()) {
        toast('error', 'Missing Supplier', 'Please enter the Supplier or Factory Name.')
        return
      }
    }

    // Build inward lines from entered quantities
    const lines: InwardStockLine[] = []
    for (const [pId, qtyStr] of Object.entries(quantities)) {
      const q = Number(qtyStr)
      if (q > 0) {
        const prod = allProducts.find(p => p.id === pId)
        if (prod) {
          lines.push({
            id: `line-${pId}`,
            entry_id: referenceNo,
            category_id: prod.category_id,
            product_id: prod.id,
            quantity: q,
            unit: prod.unit
          })
        }
      }
    }

    if (!isDraft && lines.length === 0) {
      toast('error', 'No Quantities Entered', 'Please enter received quantities for at least one product.')
      return
    }

    setIsSubmitting(true)
    try {
      const entryPayload: Omit<InwardStockEntry, 'id' | 'created_at'> = {
        reference_no: referenceNo,
        warehouse_id: warehouseId,
        entry_date: entryDate,
        challan_no: challanNo.trim() || 'DRAFT-CHALLAN',
        supplier_name: supplierName.trim() || 'Factory Receipt',
        notes: notes.trim() || null,
        status: isDraft ? 'draft' : 'saved',
        lines,
        created_by: profile.id,
        creator_name: profile.full_name
      }

      // Do not show success until Supabase confirms the transaction.
      await persistInwardEntry(entryPayload, profile)
      await hydrateCatalogCacheFromSupabase()
      const saved = getInwardEntryById(entryPayload.reference_no) ?? { ...entryPayload, id: entryPayload.reference_no, created_at: new Date().toISOString() }

      setDraftsVersion(v => v + 1)

      if (isDraft) {
        setIsDraftMode(true)
        toast('info', 'Draft Saved', `Inward draft ${saved.reference_no} saved. Stock quantities remain untouched until official submission.`)
      } else {
        setSavedSuccessRef(saved.reference_no)
        toast('success', 'Inward Stock Recorded', `Inward receipt ${saved.reference_no} submitted. Official stock updated immediately.`)
      }
    } catch (err: any) {
      toast('error', 'Operation Failed', err.message || 'Error saving inward stock.')
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
          <h2 className="text-xl font-bold text-[#102C42] mb-1">Inward Stock Successfully Saved!</h2>
          <p className="text-sm text-[#72869A] mb-6">
            Entry Reference: <span className="font-mono font-bold text-[#102C42] bg-[#F4F7FA] px-2.5 py-1 rounded-lg border border-[#DCE5EB]">{savedSuccessRef}</span>
          </p>

          <div className="p-4 rounded-2xl bg-[#E7F3F1] border border-[#0D827D]/30 text-left mb-6 text-xs text-[#20384A] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#0D827D]">
              <Package className="w-4 h-4" />
              <span>Stock Balances Updated Immediately</span>
            </div>
            <p>
              The received quantities have been added to the official inventory for <strong>{activeWarehouse.name}</strong>. No managerial approval is required for everyday goods arrival.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setSavedSuccessRef(null)
                setReferenceNo(generateRef('INW'))
                setIsDraftMode(false)
                setQuantities({})
                setChallanNo('')
                setSupplierName('')
                setNotes('')
                setSearchParams({})
              }}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Record Another Inward Entry</span>
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
        {/* Header navigation & Drafts button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/staff/stock')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#72869A] hover:text-[#102C42]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Stock Operations</span>
          </button>

          <div className="flex items-center gap-2">
            {inwardDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D827D] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl hover:bg-teal-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Drafts ({inwardDrafts.length})</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#0D827D] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl">
              <span>Ref: {referenceNo}</span>
            </div>
          </div>
        </div>

        {/* Draft Mode Banner */}
        {isDraftMode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Editing Inward Draft #{referenceNo}</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Official stock has <strong>not</strong> been changed. You can save updates repeatedly, or submit to increase stock.
              </p>
            </div>
          </div>
        )}

        {/* Title banner */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D827D] border border-teal-200 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#102C42]">Inward Stock Entry</h1>
              <p className="text-xs text-[#72869A]">Record factory arrivals & materials received into godown</p>
            </div>
          </div>
        </div>

        {/* Step 1: Godown & Date */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
            1. Receiving Location & Date
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Receiving Godown</label>
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
              <label className="label">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Steps 2, 3 & 4: Multi-Category Product Entry */}
        <div className="space-y-4">
          {activeCategorySections.map((catId, sectionIdx) => {
            const currentCat = categories.find(c => c.id === catId)
            const catProducts = allProducts.filter(p => p.category_id === catId)

            return (
              <div
                key={`${catId}-${sectionIdx}`}
                className="card p-4 border-2 border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3"
              >
                {/* Category Header & Switcher */}
                <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EB]">
                  <div className="flex-1 max-w-xs">
                    <label className="text-[10px] font-bold text-[#72869A] uppercase tracking-wider block mb-1">
                      Category #{sectionIdx + 1}
                    </label>
                    <select
                      value={catId}
                      onChange={e => handleCategoryChange(sectionIdx, e.target.value)}
                      className="input-field font-bold text-[#102C42] text-xs py-1.5"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  {activeCategorySections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCategorySection(catId)}
                      className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 p-1 hover:bg-red-50 rounded-lg"
                      title="Remove this category section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove Section</span>
                    </button>
                  )}
                </div>

                {/* Product List for this category */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#72869A] px-1">
                    <span>Product Name & Specification</span>
                    <span>Received Qty</span>
                  </div>

                  {catProducts.length > 0 ? (
                    catProducts.map(prod => {
                      const qtyVal = quantities[prod.id] || ''
                      const currentBal = stockBalanceMap[prod.id] || 0

                      return (
                        <div
                          key={prod.id}
                          className="p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[#0D827D]/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-bold text-[#102C42]">{prod.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#72869A]">
                              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#DCE5EB]">{prod.sku}</span>
                              {prod.grade && <span>Grade: {prod.grade}</span>}
                              <span>Current Stock: <strong className="text-[#102C42]">{formatNumber(currentBal)}</strong> {getUnitLabel(prod.unit)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:w-44">
                            <input
                              type="number"
                              min="0"
                              placeholder="0 (blank = none)"
                              value={qtyVal}
                              onChange={e => handleQtyChange(prod.id, e.target.value)}
                              className="input-field text-right font-extrabold text-[#16845B]"
                            />
                            <span className="text-xs font-semibold text-[#72869A] shrink-0 w-10">
                              {getUnitLabel(prod.unit)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-xs text-[#72869A] py-3 text-center">
                      No active products found in {currentCat?.name}.
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* + Add Another Category Action */}
          <button
            type="button"
            onClick={handleAddCategorySection}
            className="w-full py-3.5 border-2 border-dashed border-[#0D827D]/50 hover:border-[#0D827D] hover:bg-[#E7F3F1]/40 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-[#0D827D] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Another Category to This Entry</span>
          </button>
        </div>

        {/* Step 5: Inward Document Details */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
            3. Inward Document Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Challan / Invoice No. *</label>
              <input
                type="text"
                placeholder="e.g. CH-FINO-8819"
                value={challanNo}
                onChange={e => setChallanNo(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Supplier / Factory Name *</label>
              <input
                type="text"
                placeholder="e.g. Finolex Industries Ltd"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label">Notes / Unloading Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Unloaded trailer at Bay 2, bundle counts verified with driver"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field text-xs resize-none"
            />
          </div>
        </div>

        {/* Action Buttons: Save Draft vs Submit Inward Entry */}
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
            <span>{isSubmitting ? 'Submitting...' : isDraftMode ? 'Submit Official Entry' : 'Save Inward Entry'}</span>
          </button>
        </div>

        <p className="text-center text-[11px] text-[#72869A]">
          Drafts do not change stock. Once submitted, stock is updated immediately in the official stock ledger.
        </p>

        {/* Drafts Modal */}
        {showDraftsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-xl border border-[#DCE5EB] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D827D]" />
                  <h3 className="text-sm font-bold text-[#102C42]">Saved Inward Drafts</h3>
                </div>
                <button
                  onClick={() => setShowDraftsModal(false)}
                  className="text-[#72869A] hover:text-[#102C42] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {inwardDrafts.map(d => (
                  <div
                    key={d.id}
                    onClick={() => handleResumeDraft(d)}
                    className="p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA] hover:border-[#0D827D] hover:bg-white cursor-pointer transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#0D827D]">{d.reference_no}</span>
                        <span className="text-[10px] text-[#72869A]">{d.entry_date}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#102C42] truncate">{d.supplier_name || 'Factory Receipt'}</p>
                      <p className="text-[10px] text-[#72869A]">Challan: {d.challan_no} • {d.lines.length} items</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDraft(e, d.reference_no)}
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
