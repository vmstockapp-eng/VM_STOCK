import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Package, Calendar, Warehouse as WarehouseIcon, CheckCircle2, ChevronRight,
  Save, Send, ArrowLeft, AlertCircle, Info, RefreshCw, FileText, Check
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getCategories, getProducts, getWarehouses, getProductStockBalance,
  getDailyReports, saveDailyReport, submitDailyReport, findDraftReport
} from '../../lib/dataService'
import type { Category, Product, DailyStockReport, DailyStockReportLine } from '../../types'
import { calcClosingStock, formatNumber, getUnitLabel, cn } from '../../lib/utils'

interface ProductEntryState {
  productId: string
  openingStock: number
  inwardQty: number
  outwardQty: number
  closingStock: number
  notes: string
}

export default function StaffStockEntry() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const draftIdParam = searchParams.get('draftId')

  // Step 1: Session setup
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => profile?.warehouse_id || 'w-2')
  const [sessionNotes, setSessionNotes] = useState('')
  const [activeReportId, setActiveReportId] = useState<string | undefined>(draftIdParam || undefined)

  // Step 2 & 3: Category & Product Entry
  const [step, setStep] = useState<'setup' | 'category_select' | 'product_entry'>('setup')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [completedCategoryIds, setCompletedCategoryIds] = useState<string[]>([])

  // Product Line Items for active category: map of productId -> ProductEntryState
  const [productLines, setProductLines] = useState<Record<string, ProductEntryState>>({})
  const [allSavedLines, setAllSavedLines] = useState<DailyStockReportLine[]>([])

  // Submitting / Saving states
  const [isSaving, setIsSaving] = useState(false)
  const [existingDraftFound, setExistingDraftFound] = useState<DailyStockReport | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  const categories = useMemo(() => getCategories(), [])
  const allProducts = useMemo(() => getProducts(), [])
  const warehouses = useMemo(() => getWarehouses(), [])

  // If draftId was passed in URL, load it directly
  useEffect(() => {
    if (draftIdParam) {
      const reports = getDailyReports()
      const draft = reports.find(r => r.id === draftIdParam)
      if (draft) {
        setReportDate(draft.report_date)
        setSelectedWarehouseId(draft.warehouse_id)
        setSessionNotes(draft.notes || '')
        setActiveReportId(draft.id)
        if (draft.lines) {
          setAllSavedLines(draft.lines)
          const doneCats = Array.from(new Set(draft.lines.map(l => l.category_id)))
          setCompletedCategoryIds(doneCats)
        }
        setStep('category_select')
      }
    }
  }, [draftIdParam])

  // Check for existing draft on setup step
  useEffect(() => {
    if (step === 'setup' && profile) {
      const draft = findDraftReport(reportDate, selectedWarehouseId, profile.id)
      if (draft && draft.id !== activeReportId) {
        setExistingDraftFound(draft)
      } else {
        setExistingDraftFound(null)
      }
    }
  }, [reportDate, selectedWarehouseId, step, profile, activeReportId])

  // When a category is picked, initialize product lines
  const startCategoryEntry = (cat: Category) => {
    setSelectedCategory(cat)
    const prods = allProducts.filter(p => p.category_id === cat.id && p.is_active)

    const initialMap: Record<string, ProductEntryState> = {}

    for (const prod of prods) {
      // Check if already in allSavedLines
      const saved = allSavedLines.find(l => l.product_id === prod.id)
      if (saved) {
        initialMap[prod.id] = {
          productId: prod.id,
          openingStock: saved.opening_stock,
          inwardQty: saved.inward_qty,
          outwardQty: saved.outward_qty,
          closingStock: saved.closing_stock,
          notes: saved.notes || ''
        }
      } else {
        // Derive opening stock from system balance
        const opening = getProductStockBalance(prod.id, selectedWarehouseId)
        initialMap[prod.id] = {
          productId: prod.id,
          openingStock: opening,
          inwardQty: 0,
          outwardQty: 0,
          closingStock: opening,
          notes: ''
        }
      }
    }

    setProductLines(initialMap)
    setStep('product_entry')
  }

  // Handle Input Changes for a product line
  const handleQuantityChange = (productId: string, field: 'inwardQty' | 'outwardQty', valueStr: string) => {
    const num = Math.max(0, Number(valueStr) || 0)
    setProductLines(prev => {
      const line = prev[productId]
      if (!line) return prev
      const updated = { ...line, [field]: num }
      updated.closingStock = calcClosingStock(updated.openingStock, updated.inwardQty, updated.outwardQty)
      return { ...prev, [productId]: updated }
    })
  }

  // Resume Existing Draft
  const handleResumeDraft = (draft: DailyStockReport) => {
    setActiveReportId(draft.id)
    setReportDate(draft.report_date)
    setSelectedWarehouseId(draft.warehouse_id)
    setSessionNotes(draft.notes || '')
    if (draft.lines) {
      setAllSavedLines(draft.lines)
      const doneCats = Array.from(new Set(draft.lines.map(l => l.category_id)))
      setCompletedCategoryIds(doneCats)
    }
    setExistingDraftFound(null)
    setStep('category_select')
    toast('info', 'Draft Resumed', `Continuing draft from ${draft.report_date}`)
  }

  // Save current category lines into allSavedLines and local store
  const saveCurrentCategoryWork = (status: 'draft' = 'draft'): DailyStockReport => {
    if (!profile) throw new Error('Not authenticated')
    if (!selectedCategory) throw new Error('No category selected')

    // Create lines from current productLines
    const newLinesForCat: DailyStockReportLine[] = Object.values(productLines).map(item => ({
      id: `line-${item.productId}-${Date.now()}`,
      report_id: activeReportId || '',
      product_id: item.productId,
      category_id: selectedCategory.id,
      opening_stock: item.openingStock,
      inward_qty: item.inwardQty,
      outward_qty: item.outwardQty,
      closing_stock: item.closingStock,
      notes: item.notes || null,
      created_at: new Date().toISOString()
    }))

    // Merge with other category lines
    const remainingLines = allSavedLines.filter(l => l.category_id !== selectedCategory.id)
    const combinedLines = [...remainingLines, ...newLinesForCat]
    setAllSavedLines(combinedLines)

    // Mark category as completed
    if (!completedCategoryIds.includes(selectedCategory.id)) {
      setCompletedCategoryIds(prev => [...prev, selectedCategory.id])
    }

    // Persist to store
    const reportToSave: DailyStockReport = {
      id: activeReportId || '',
      report_date: reportDate,
      warehouse_id: selectedWarehouseId,
      created_by: profile.id,
      creator_name: profile.full_name,
      status: status,
      notes: sessionNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lines: combinedLines
    }

    const saved = saveDailyReport(reportToSave)
    if (!activeReportId) setActiveReportId(saved.id)
    return saved
  }

  // Action: Save Draft (stays on page or notifies)
  const handleSaveDraft = () => {
    setIsSaving(true)
    try {
      saveCurrentCategoryWork('draft')
      toast('success', 'Draft Saved', `Work for ${selectedCategory?.name} saved locally.`)
    } catch (err: any) {
      toast('error', 'Error Saving Draft', err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Action: Save & Add Category (goes back to category picker)
  const handleSaveAndAddCategory = () => {
    setIsSaving(true)
    try {
      saveCurrentCategoryWork('draft')
      toast('success', `${selectedCategory?.name} Saved`, `Select next category to continue.`)
      setStep('category_select')
    } catch (err: any) {
      toast('error', 'Error Saving', err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Action: Final Submission
  const handleFinalSubmit = () => {
    if (!profile) return
    setIsSaving(true)
    try {
      // If currently on product entry, save that first
      if (step === 'product_entry' && selectedCategory) {
        saveCurrentCategoryWork('draft')
      }

      if (!activeReportId) {
        toast('warning', 'Empty Report', 'Please enter at least one product before submitting.')
        setIsSaving(false)
        return
      }

      submitDailyReport(activeReportId, profile)
      toast('success', 'Report Submitted!', 'Sent to supervisor for approval.')
      navigate('/staff/my-entries')
    } catch (err: any) {
      toast('error', 'Submission Failed', err.message)
    } finally {
      setIsSaving(false)
      setShowSummaryModal(false)
    }
  }

  // Category products list
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return []
    return allProducts.filter(p => p.category_id === selectedCategory.id && p.is_active)
  }, [allProducts, selectedCategory])

  // Total summary of all entered lines
  const totalEnteredProducts = allSavedLines.length + (step === 'product_entry' ? Object.keys(productLines).length : 0)

  return (
    <StaffLayout
      title="Daily Stock Entry"
      showBackButton={step !== 'setup'}
      onBack={() => {
        if (step === 'product_entry') setStep('category_select')
        else if (step === 'category_select') setStep('setup')
      }}
    >
      <div className="space-y-4">
        {/* ================= STEP 1: REPORT SETUP ================= */}
        {step === 'setup' && (
          <div className="space-y-4">
            <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
                <Calendar className="w-5 h-5 text-teal-DEFAULT" />
                <h3 className="font-bold text-sm text-navy-DEFAULT">Report Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="label">Stock Date</label>
                  <input
                    type="date"
                    className="input-field text-sm font-medium"
                    value={reportDate}
                    onChange={e => setReportDate(e.target.value)}
                  />
                  <p className="text-[11px] text-brand-textSecondary mt-1">Default is today's shift date.</p>
                </div>

                <div>
                  <label className="label">Godown / Location</label>
                  <div className="relative">
                    <select
                      className="input-field text-sm font-medium appearance-none pr-8"
                      value={selectedWarehouseId}
                      disabled={profile?.role === 'staff' && Boolean(profile.warehouse_id)}
                      onChange={e => setSelectedWarehouseId(e.target.value)}
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                    <WarehouseIcon className="w-4 h-4 text-brand-textSecondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {profile?.role === 'staff' && profile.warehouse_id && (
                    <p className="text-[11px] text-teal-DEFAULT mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Locked to your assigned godown location.
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Shift Notes (Optional)</label>
                  <textarea
                    rows={2}
                    className="input-field text-xs resize-none"
                    placeholder="e.g. Heavy dispatch for irrigation project; truck 4 reached 5pm..."
                    value={sessionNotes}
                    onChange={e => setSessionNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Existing Draft Warning / Offer */}
              {existingDraftFound && (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-navy-DEFAULT">Existing Draft Found!</p>
                      <p className="text-[11px] text-brand-textSecondary mt-0.5">
                        A draft report already exists for this date and warehouse with {existingDraftFound.lines?.length || 0} items.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleResumeDraft(existingDraftFound)}
                        className="mt-2 text-xs font-bold text-teal-DEFAULT hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Resume Saved Draft →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setStep('category_select')}
                className="btn-primary w-full py-3 mt-5 flex items-center justify-center gap-2 font-bold shadow-sm"
              >
                <span>Proceed to Select Category</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: CATEGORY SELECTION ================= */}
        {step === 'category_select' && (
          <div className="space-y-4">
            {/* Header / Session Details */}
            <div className="bg-white p-3.5 rounded-2xl border border-brand-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-brand-textSecondary font-medium">Reporting for:</p>
                <p className="text-xs font-bold text-navy-DEFAULT">
                  {warehouses.find(w => w.id === selectedWarehouseId)?.name} • {reportDate}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-teal-DEFAULT">
                  {completedCategoryIds.length} of {categories.length}
                </span>
                <p className="text-[10px] text-brand-textSecondary">Categories Done</p>
              </div>
            </div>

            {/* Category Grid */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-brand-textSecondary uppercase tracking-wider px-0.5">
                Select Product Category
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categories.map(cat => {
                  const isDone = completedCategoryIds.includes(cat.id)
                  const countInCat = allProducts.filter(p => p.category_id === cat.id && p.is_active).length

                  return (
                    <button
                      key={cat.id}
                      onClick={() => startCategoryEntry(cat)}
                      className={cn(
                        'flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left shadow-sm active:scale-[0.99]',
                        isDone
                          ? 'bg-teal-50/50 border-teal-200'
                          : 'bg-white border-brand-border hover:border-teal-DEFAULT'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs',
                          isDone ? 'bg-teal-DEFAULT text-white' : 'bg-brand-bg text-navy-DEFAULT border border-brand-border'
                        )}>
                          {cat.code}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-navy-DEFAULT">{cat.name}</h4>
                            {isDone && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-teal-DEFAULT bg-teal-100 px-1.5 py-0.2 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Done
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-brand-textSecondary truncate max-w-[180px]">
                            {countInCat} active SKU specifications
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-brand-textSecondary" />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bottom Actions when on Category Select */}
            {allSavedLines.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(true)}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold shadow-md bg-navy-DEFAULT hover:bg-navy-700"
                >
                  <Send className="w-4 h-4 text-teal-100" />
                  <span>Review & Submit Complete Report ({allSavedLines.length} Items)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: PRODUCT ENTRY FOR SELECTED CATEGORY ================= */}
        {step === 'product_entry' && selectedCategory && (
          <div className="space-y-4">
            {/* Category Banner */}
            <div className="bg-navy-DEFAULT text-white p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-100 tracking-wider">Current Category</span>
                <h3 className="text-base font-bold text-white">{selectedCategory.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setStep('category_select')}
                className="text-xs text-navy-100 hover:text-white bg-navy-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                Change Category
              </button>
            </div>

            {/* Instruction Tip */}
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-[11px] text-brand-textPrimary flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-DEFAULT shrink-0" />
              <span>
                <strong>Opening stock</strong> is locked from system ledger. Enter <strong>Inward</strong> received and <strong>Sold/Outward</strong> dispatched to calculate closing stock.
              </span>
            </div>

            {/* Products List (Cards on Mobile, Table on Desktop) */}
            <div className="space-y-3">
              {categoryProducts.map(prod => {
                const line = productLines[prod.id] || {
                  productId: prod.id,
                  openingStock: 0,
                  inwardQty: 0,
                  outwardQty: 0,
                  closingStock: 0,
                  notes: ''
                }

                const unitLabel = getUnitLabel(prod.unit)
                const isNegativeClosing = line.closingStock < 0

                return (
                  <div
                    key={prod.id}
                    className="card border border-brand-border bg-white rounded-2xl shadow-card p-4 transition-all"
                  >
                    {/* Product Specification Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-brand-border/60">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-navy-50 text-navy-DEFAULT border border-navy-100">
                            {prod.sku}
                          </span>
                          {prod.grade && (
                            <span className="text-[10px] font-semibold text-brand-textSecondary bg-brand-bg px-1.5 py-0.5 rounded">
                              {prod.grade}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-navy-DEFAULT mt-1">{prod.name}</h4>
                        <p className="text-[11px] text-brand-textSecondary">
                          {prod.diameter_mm ? `${prod.diameter_mm} mm` : ''}
                          {prod.pressure_rating_kg ? ` • ${prod.pressure_rating_kg} kg rating` : ''}
                          {prod.coil_length_m ? ` • ${prod.coil_length_m}m coil` : ''}
                          {` • Unit: ${unitLabel}`}
                        </p>
                      </div>
                    </div>

                    {/* Numeric Input Row: Opening | Inward | Outward | Closing */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-1">
                      {/* Opening Stock (Locked) */}
                      <div className="bg-brand-bg/70 p-2.5 rounded-xl border border-brand-border/60">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-textSecondary">
                          Opening Stock
                        </span>
                        <p className="text-sm font-bold text-navy-DEFAULT mt-1">
                          {formatNumber(line.openingStock)} <span className="text-[10px] font-normal text-brand-textSecondary">{unitLabel}</span>
                        </p>
                        <span className="text-[9px] text-brand-textSecondary block mt-0.5">System balance</span>
                      </div>

                      {/* Inward Quantity */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-success mb-1">
                          + Inward / Rcvd
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step={prod.unit === 'piece' || prod.unit === 'tank' ? '1' : 'any'}
                            inputMode="numeric"
                            className="input-field text-sm font-bold text-brand-success border-green-200 focus:ring-green-500 py-1.5"
                            value={line.inwardQty === 0 ? '' : line.inwardQty}
                            placeholder="0"
                            onChange={e => handleQuantityChange(prod.id, 'inwardQty', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Sold / Outward Quantity */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-error mb-1">
                          − Sold / Outward
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step={prod.unit === 'piece' || prod.unit === 'tank' ? '1' : 'any'}
                            inputMode="numeric"
                            className="input-field text-sm font-bold text-brand-error border-red-200 focus:ring-red-500 py-1.5"
                            value={line.outwardQty === 0 ? '' : line.outwardQty}
                            placeholder="0"
                            onChange={e => handleQuantityChange(prod.id, 'outwardQty', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Closing Stock (Calculated) */}
                      <div className={cn(
                        'p-2.5 rounded-xl border transition-colors',
                        isNegativeClosing
                          ? 'bg-red-50 border-red-200 text-brand-error'
                          : 'bg-teal-50 border-teal-100 text-teal-DEFAULT'
                      )}>
                        <span className="block text-[10px] font-bold uppercase tracking-wider">
                          = Closing Stock
                        </span>
                        <p className="text-base font-extrabold mt-0.5 truncate">
                          {formatNumber(line.closingStock)} <span className="text-[10px] font-normal">{unitLabel}</span>
                        </p>
                        {isNegativeClosing ? (
                          <span className="text-[9px] font-bold text-brand-error block">Warning: Negative!</span>
                        ) : (
                          <span className="text-[9px] text-teal-DEFAULT/80 block">Calculated</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Category Bottom Actions: Save Draft & Save & Add Category */}
            <div className="sticky bottom-16 bg-white/95 backdrop-blur-md p-3 -mx-3 sm:-mx-4 border-t border-brand-border shadow-lg rounded-t-2xl z-20 flex gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold"
              >
                <Save className="w-4 h-4 text-brand-textSecondary" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndAddCategory}
                disabled={isSaving}
                className="btn-primary flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>Save & Add Category</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= MODAL: FINAL REPORT SUMMARY ================= */}
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 pb-3 border-b border-brand-border">
                <FileText className="w-5 h-5 text-teal-DEFAULT" />
                <h3 className="font-bold text-base text-navy-DEFAULT">Submit Daily Stock Report</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-brand-border/40">
                  <span className="text-brand-textSecondary">Report Date:</span>
                  <span className="font-bold text-navy-DEFAULT">{reportDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-border/40">
                  <span className="text-brand-textSecondary">Warehouse:</span>
                  <span className="font-bold text-navy-DEFAULT">
                    {warehouses.find(w => w.id === selectedWarehouseId)?.name}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-border/40">
                  <span className="text-brand-textSecondary">Categories Entered:</span>
                  <span className="font-bold text-teal-DEFAULT">{completedCategoryIds.length} categories</span>
                </div>
                <div className="flex justify-between py-1 border-b border-brand-border/40">
                  <span className="text-brand-textSecondary">Total Product SKUs:</span>
                  <span className="font-bold text-navy-DEFAULT">{allSavedLines.length} products</span>
                </div>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-[11px] text-teal-DEFAULT">
                <strong>Accounting Rule:</strong> Submitting will record this report for admin verification. Stock balances will update upon approval.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(false)}
                  className="btn-secondary flex-1 py-2 text-xs"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSaving}
                  className="btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirm & Submit</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
