import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ClipboardList, Calendar, Warehouse as WarehouseIcon, AlertTriangle,
  CheckCircle2, Send, Save, Info, RefreshCw, FileText, X, ArrowLeft, ChevronRight, Trash2
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getCategories, getProducts, getWarehouses, getProductStockBalance,
  savePhysicalCount, getPhysicalCounts, getPhysicalCountById,
  getPhysicalCountDrafts, deletePhysicalCountDraft
} from '../../lib/dataService'
import type { PhysicalCount, PhysicalCountLine } from '../../types'
import { formatNumber, generateRef, getUnitLabel, cn, formatDate } from '../../lib/utils'

export default function StaffPhysicalCount() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const draftParam = searchParams.get('draftId') || searchParams.get('ref')

  const categories = useMemo(() => getCategories(), [])
  const allProducts = useMemo(() => getProducts(), [])
  const warehouses = useMemo(() => getWarehouses(), [])

  const defaultWh = profile?.warehouse_id || 'w-2'
  const [warehouseId, setWarehouseId] = useState(defaultWh)
  const [countDate, setCountDate] = useState(() => new Date().toISOString().split('T')[0])
  const [referenceNo, setReferenceNo] = useState(() => draftParam || generateRef('PC'))
  const [isDraftMode, setIsDraftMode] = useState(Boolean(draftParam))
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '')
  const [generalNotes, setGeneralNotes] = useState('')

  // Map of productId -> counted quantity
  const [countedQuantities, setCountedQuantities] = useState<Record<string, string>>({})
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [draftsVersion, setDraftsVersion] = useState(0)

  // Physical count drafts
  const countDrafts = useMemo(() => {
    return getPhysicalCountDrafts(warehouseId)
  }, [warehouseId, draftsVersion])

  // Load draft if draftParam present
  useEffect(() => {
    if (draftParam) {
      const draft = getPhysicalCountById(draftParam)
      if (draft) {
        setReferenceNo(draft.reference_no)
        setIsDraftMode(true)
        setWarehouseId(draft.warehouse_id)
        setCountDate(draft.count_date)
        setGeneralNotes(draft.notes || '')

        const qtyMap: Record<string, string> = {}
        const notesMap: Record<string, string> = {}
        if (draft.lines) {
          for (const line of draft.lines) {
            qtyMap[line.product_id] = String(line.counted_stock)
            if (line.notes) notesMap[line.product_id] = line.notes
          }
          // Set category from first product in draft if available
          const firstProd = allProducts.find(p => p.id === draft.lines?.[0]?.product_id)
          if (firstProd) setSelectedCategoryId(firstProd.category_id)
        }
        setCountedQuantities(qtyMap)
        setLineNotes(notesMap)
      }
    }
  }, [draftParam, allProducts])

  // Products under selected category
  const categoryProducts = useMemo(() => {
    return allProducts.filter(p => p.category_id === selectedCategoryId && p.is_active)
  }, [allProducts, selectedCategoryId])

  // Computed Lines with System Stock and Variance
  const evaluatedLines = useMemo(() => {
    return categoryProducts.map(prod => {
      const systemStock = getProductStockBalance(prod.id, warehouseId)
      const inputStr = countedQuantities[prod.id]
      const hasInput = inputStr !== undefined && inputStr !== ''
      const counted = hasInput ? Number(inputStr) || 0 : systemStock
      const variance = counted - systemStock

      return {
        product: prod,
        systemStock,
        counted,
        hasInput,
        variance,
        isDiscrepancy: variance !== 0,
        notes: lineNotes[prod.id] || ''
      }
    })
  }, [categoryProducts, warehouseId, countedQuantities, lineNotes])

  const totalDiscrepancies = evaluatedLines.filter(l => l.variance !== 0).length

  const handleCountChange = (productId: string, val: string) => {
    setCountedQuantities(prev => ({ ...prev, [productId]: val }))
  }

  const handleLineNotesChange = (productId: string, val: string) => {
    setLineNotes(prev => ({ ...prev, [productId]: val }))
  }

  const handleResumeDraft = (draft: PhysicalCount) => {
    setSearchParams({ draftId: draft.reference_no })
    setShowDraftsModal(false)
  }

  const handleDeleteDraft = (e: React.MouseEvent, ref: string) => {
    e.stopPropagation()
    deletePhysicalCountDraft(ref)
    setDraftsVersion(v => v + 1)
    toast('info', 'Draft Deleted', `Draft count ${ref} removed.`)
    if (referenceNo === ref) {
      setReferenceNo(generateRef('PC'))
      setIsDraftMode(false)
      setSearchParams({})
    }
  }

  const handleSaveCount = (status: 'draft' | 'submitted') => {
    if (!profile) return
    setIsSubmitting(true)
    try {
      const lines: PhysicalCountLine[] = evaluatedLines.map(item => ({
        id: `pcl-${item.product.id}-${Date.now()}`,
        count_id: referenceNo,
        product_id: item.product.id,
        system_stock: item.systemStock,
        counted_stock: item.counted,
        variance: item.variance,
        notes: item.notes || null,
        status: item.variance === 0 ? 'matched' : 'discrepancy'
      }))

      const newCount: PhysicalCount = {
        id: '',
        reference_no: referenceNo,
        count_date: countDate,
        warehouse_id: warehouseId,
        created_by: profile.id,
        creator_name: profile.full_name,
        status: status,
        notes: generalNotes,
        created_at: new Date().toISOString(),
        lines: lines
      }

      savePhysicalCount(newCount, profile)
      setDraftsVersion(v => v + 1)

      if (status === 'submitted') {
        toast('success', 'Physical Count Completed', `Stock balances updated directly (${totalDiscrepancies} variances adjusted).`)
        setReferenceNo(generateRef('PC'))
        setIsDraftMode(false)
        setCountedQuantities({})
        setLineNotes({})
        setGeneralNotes('')
        setSearchParams({})
      } else {
        setIsDraftMode(true)
        toast('info', 'Draft Saved', 'Physical count saved as draft. Official stock has not been altered.')
      }
    } catch (err: any) {
      toast('error', 'Error Saving Physical Count', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Past physical counts for this warehouse
  const pastCounts = useMemo(() => getPhysicalCounts(warehouseId), [warehouseId, draftsVersion])

  return (
    <StaffLayout title="Physical Count & Verification">
      <div className="space-y-4 max-w-2xl mx-auto pb-12">
        {/* Top Navigation & Drafts button */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/staff/stock')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#72869A] hover:text-[#102C42]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Stock Operations</span>
          </button>

          <div className="flex items-center gap-2">
            {countDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D827D] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl hover:bg-teal-100 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Drafts ({countDrafts.length})</span>
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
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Editing Draft Count #{referenceNo}</span>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Official stock balances have <strong>not</strong> been modified. Submit when verification is complete.
              </p>
            </div>
          </div>
        )}

        {/* Setup Card */}
        <div className="card border border-[#DCE5EB] bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#DCE5EB]">
            <ClipboardList className="w-5 h-5 text-[#0D827D]" />
            <h3 className="font-bold text-sm text-[#102C42]">Manual Stock Verification Setup</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="label">Count Date</label>
              <input
                type="date"
                className="input-field text-xs font-medium"
                value={countDate}
                onChange={e => setCountDate(e.target.value)}
              />
            </div>

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

            <div>
              <label className="label">Category Filter</label>
              <select
                className="input-field text-xs font-medium"
                value={selectedCategoryId}
                onChange={e => {
                  setSelectedCategoryId(e.target.value)
                  setCountedQuantities({})
                }}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-[#E7F3F1] rounded-xl border border-[#0D827D]/30 text-[11px] text-[#20384A] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#0D827D] shrink-0" />
            <span>
              <strong>Direct Stock Adjustment:</strong> Submitting will adjust godown inventory to match the counted quantity and record traceable adjustment ledger entries.
            </span>
          </div>
        </div>

        {/* Product Physical Count List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-[#72869A] uppercase tracking-wider">
              {categoryProducts.length} Items to Audit
            </h3>
            {totalDiscrepancies > 0 && (
              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {totalDiscrepancies} Discrepancy Found
              </span>
            )}
          </div>

          {evaluatedLines.map(item => {
            const unitLabel = getUnitLabel(item.product.unit)
            return (
              <div
                key={item.product.id}
                className={cn(
                  'card border bg-white rounded-2xl shadow-sm p-4 transition-all',
                  item.isDiscrepancy ? 'border-amber-300 ring-1 ring-amber-100' : 'border-[#DCE5EB]'
                )}
              >
                <div className="flex items-start justify-between pb-2 border-b border-[#DCE5EB]/60">
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-[#102C42] border border-[#DCE5EB]">
                      {item.product.sku}
                    </span>
                    <h4 className="text-sm font-bold text-[#102C42] mt-1">{item.product.name}</h4>
                  </div>
                  <span className={cn(
                    'text-[10px] uppercase font-bold px-2 py-0.5 rounded-full',
                    item.isDiscrepancy
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-green-100 text-green-800'
                  )}>
                    {item.isDiscrepancy ? 'Variance Flagged' : 'Matched'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-[#F4F7FA] p-2 rounded-xl border border-[#DCE5EB]">
                    <span className="text-[10px] text-[#72869A] block uppercase font-semibold">Expected System</span>
                    <p className="text-sm font-bold text-[#102C42] mt-0.5">
                      {formatNumber(item.systemStock)} <span className="text-[10px] font-normal">{unitLabel}</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#0D827D] block uppercase font-bold">Physical Count</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="input-field text-center font-bold text-sm py-1.5 mt-0.5"
                      placeholder={String(item.systemStock)}
                      value={countedQuantities[item.product.id] ?? ''}
                      onChange={e => handleCountChange(item.product.id, e.target.value)}
                    />
                  </div>

                  <div className={cn(
                    'p-2 rounded-xl border',
                    item.variance < 0 ? 'bg-red-50 border-red-200 text-red-700' :
                    item.variance > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                    'bg-green-50 border-green-200 text-green-700'
                  )}>
                    <span className="text-[10px] block uppercase font-bold">Variance</span>
                    <p className="text-sm font-extrabold mt-0.5">
                      {item.variance > 0 ? `+${formatNumber(item.variance)}` : formatNumber(item.variance)}
                    </p>
                  </div>
                </div>

                {/* Line note if discrepancy */}
                {item.isDiscrepancy && (
                  <div className="mt-2.5 pt-2 border-t border-[#DCE5EB]/60">
                    <input
                      type="text"
                      className="input-field text-xs"
                      placeholder="Reason for difference (e.g. damaged bundle, transit loss, unlabelled bay)..."
                      value={lineNotes[item.product.id] || ''}
                      onChange={e => handleLineNotesChange(item.product.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleSaveCount('draft')}
            disabled={isSubmitting}
            className="btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4 text-[#72869A]" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveCount('submitted')}
            disabled={isSubmitting}
            className="btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting...' : isDraftMode ? 'Submit Verification' : 'Submit & Adjust Stock'}</span>
          </button>
        </div>

        {/* Drafts Modal */}
        {showDraftsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-xl border border-[#DCE5EB] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DCE5EB]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0D827D]" />
                  <h3 className="text-sm font-bold text-[#102C42]">Saved Verification Drafts</h3>
                </div>
                <button
                  onClick={() => setShowDraftsModal(false)}
                  className="text-[#72869A] hover:text-[#102C42] p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {countDrafts.map(d => (
                  <div
                    key={d.id}
                    onClick={() => handleResumeDraft(d)}
                    className="p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA] hover:border-[#0D827D] hover:bg-white cursor-pointer transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-[#0D827D]">{d.reference_no}</span>
                        <span className="text-[10px] text-[#72869A]">{d.count_date}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#102C42]">{d.lines?.length || 0} Products Audited</p>
                      <p className="text-[10px] text-[#72869A]">{d.notes || 'Draft verification'}</p>
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

        {/* Past Audits */}
        {pastCounts.filter(p => p.status !== 'draft').length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-bold text-[#72869A] uppercase tracking-wider mb-2 px-0.5">
              Completed Physical Audits
            </h3>
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-sm divide-y divide-[#DCE5EB] overflow-hidden text-xs">
              {pastCounts.filter(p => p.status !== 'draft').slice(0, 3).map(pc => (
                <div key={pc.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#102C42]">{pc.reference_no}</p>
                    <p className="text-[11px] text-[#72869A]">{formatDate(pc.count_date)} • {pc.lines?.length || 0} Products Verified</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    {pc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StaffLayout>
  )
}
