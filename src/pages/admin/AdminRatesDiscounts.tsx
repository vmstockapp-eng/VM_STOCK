import React, { useState, useMemo } from 'react'
import {
  Percent, Plus, Search, Tag, Calculator, Calendar, CheckCircle2,
  Trash2, Edit, ArrowRight
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import Modal from '../../components/ui/Modal'
import { getPriceRules, getProducts, getCategories, savePriceRule, deletePriceRule } from '../../lib/dataService'
import { useToast } from '../../store/ToastContext'
import { formatCurrency, formatNumber, formatDate } from '../../lib/utils'
import type { PriceRule } from '../../types'

export default function AdminRatesDiscounts() {
  const { toast } = useToast()

  const products = useMemo(() => getProducts(), [])
  const categories = useMemo(() => getCategories(), [])
  const [rulesList, setRulesList] = useState<PriceRule[]>(() => getPriceRules())

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [ruleType, setRuleType] = useState<PriceRule['rule_type']>('category_discount')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [productId, setProductId] = useState(products[0]?.id || '')
  const [discountPercent, setDiscountPercent] = useState('5.0')
  const [minQuantity, setMinQuantity] = useState('100')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().split('T')[0])
  const [effectiveTo, setEffectiveTo] = useState('2026-12-31')
  const [isActive, setIsActive] = useState(true)

  // Interactive Price Calculator Sandbox
  const [calcProductId, setCalcProductId] = useState(products[0]?.id || '')
  const [calcQuantity, setCalcQuantity] = useState('500')

  const calcProduct = products.find(p => p.id === calcProductId) || products[0]

  // Calculation Breakdown
  const calculationResult = useMemo(() => {
    if (!calcProduct) return null
    const qty = Number(calcQuantity) || 1
    const baseRate = calcProduct.rate
    const grossAmount = baseRate * qty

    // Find highest applicable active discount rule
    let appliedDiscountPct = 0
    let appliedRuleName = 'Standard Rate (No Discount)'

    for (const rule of rulesList) {
      if (!rule.is_active) continue
      const appliesProduct = rule.rule_type === 'product_discount' && rule.product_id === calcProduct.id
      const appliesCategory = rule.rule_type === 'category_discount' && rule.category_id === calcProduct.category_id
      const minQtyMet = !rule.min_quantity || qty >= rule.min_quantity

      if ((appliesProduct || appliesCategory) && minQtyMet) {
        if (rule.discount_percent > appliedDiscountPct) {
          appliedDiscountPct = rule.discount_percent
          appliedRuleName = rule.name
        }
      }
    }

    const discountAmount = grossAmount * (appliedDiscountPct / 100)
    const taxableAmount = grossAmount - discountAmount
    const gstPercent = calcProduct.gst_percent || 18
    const gstAmount = taxableAmount * (gstPercent / 100)
    const finalAmount = taxableAmount + gstAmount
    const effectiveUnitRate = finalAmount / qty

    return {
      grossAmount,
      appliedDiscountPct,
      appliedRuleName,
      discountAmount,
      taxableAmount,
      gstPercent,
      gstAmount,
      finalAmount,
      effectiveUnitRate
    }
  }, [calcProduct, calcQuantity, rulesList])

  const openAddModal = () => {
    setEditingRule(null)
    setName('')
    setRuleType('category_discount')
    setCategoryId(categories[0]?.id || '')
    setProductId(products[0]?.id || '')
    setDiscountPercent('5.0')
    setMinQuantity('100')
    setEffectiveFrom(new Date().toISOString().split('T')[0])
    setEffectiveTo('2026-12-31')
    setIsActive(true)
    setModalOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('error', 'Missing Information', 'Rule name is required.')
      return
    }

    try {
      savePriceRule({
        id: editingRule?.id || '',
        name: name.trim(),
        rule_type: ruleType,
        category_id: ruleType === 'category_discount' ? categoryId : null,
        product_id: ruleType === 'product_discount' ? productId : null,
        discount_percent: Number(discountPercent) || 0,
        min_quantity: minQuantity ? Number(minQuantity) : null,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        is_active: isActive,
        created_at: editingRule?.created_at || new Date().toISOString()
      })

      setRulesList(getPriceRules())
      setModalOpen(false)
      toast('success', 'Rule Saved', `${name} discount rule active.`)
    } catch (err: any) {
      toast('error', 'Failed to Save', err.message)
    }
  }

  const handleDelete = (id: string) => {
    deletePriceRule(id)
    setRulesList(getPriceRules())
    toast('success', 'Rule Deleted', 'Discount rule removed.')
  }

  return (
    <AdminLayout title="Rates, GST & Discount Rules">
      <div className="space-y-6">
        {/* Interactive Price Calculator Simulator */}
        <div className="card border border-teal-200 bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <Calculator className="w-5 h-5 text-teal-DEFAULT" />
            <div>
              <h3 className="font-bold text-sm text-navy-DEFAULT">Interactive Wholesale Price & GST Calculator</h3>
              <p className="text-[11px] text-brand-textSecondary">
                Simulate commercial billing: standard rate → applicable discount rule → taxable → GST → net invoice value
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Input Controls */}
            <div className="space-y-3">
              <div>
                <label className="label">Select Pipe / Product SKU</label>
                <select
                  className="input-field text-xs font-medium"
                  value={calcProductId}
                  onChange={e => setCalcProductId(e.target.value)}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatCurrency(p.rate)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Order Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field text-sm font-bold"
                  value={calcQuantity}
                  onChange={e => setCalcQuantity(e.target.value)}
                />
              </div>

              <div className="p-3 bg-brand-bg rounded-xl border border-brand-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-brand-textSecondary">Base Rate:</span>
                  <span className="font-bold text-navy-DEFAULT">{formatCurrency(calcProduct?.rate)} / unit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-textSecondary">Applicable GST:</span>
                  <span className="font-bold text-navy-DEFAULT">{calcProduct?.gst_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-textSecondary">Rule Applied:</span>
                  <span className="font-semibold text-teal-DEFAULT truncate max-w-[150px]">
                    {calculationResult?.appliedRuleName}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Waterfall Breakdown */}
            <div className="md:col-span-2 bg-gradient-to-br from-brand-bg to-teal-50/30 p-4 rounded-xl border border-brand-border flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-brand-border/60">
                  <span className="text-brand-textSecondary">Gross Subtotal ({calcQuantity} × {formatCurrency(calcProduct?.rate)}):</span>
                  <span className="font-semibold text-navy-DEFAULT">{formatCurrency(calculationResult?.grossAmount)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-brand-border/60">
                  <span className="text-brand-textSecondary">
                    Discount ({calculationResult?.appliedDiscountPct}%):
                  </span>
                  <span className="font-semibold text-brand-success">
                    −{formatCurrency(calculationResult?.discountAmount)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-brand-border/60">
                  <span className="text-navy-DEFAULT font-bold">Taxable Amount:</span>
                  <span className="font-bold text-navy-DEFAULT">{formatCurrency(calculationResult?.taxableAmount)}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-brand-border/60">
                  <span className="text-brand-textSecondary">GST Tax ({calculationResult?.gstPercent}%):</span>
                  <span className="font-semibold text-navy-DEFAULT">+{formatCurrency(calculationResult?.gstAmount)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-2 border-teal-DEFAULT flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Total Invoice Value</span>
                  <span className="text-xl font-extrabold text-navy-DEFAULT">
                    {formatCurrency(calculationResult?.finalAmount)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-brand-textSecondary block">Effective Rate per Unit</span>
                  <span className="text-base font-extrabold text-teal-DEFAULT">
                    {formatCurrency(calculationResult?.effectiveUnitRate)} / unit
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discount Rules Management */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brand-border">
            <div>
              <h3 className="font-bold text-sm text-navy-DEFAULT">Configured Discount & Price Rules</h3>
              <p className="text-xs text-brand-textSecondary">Category and product-specific commercial rules</p>
            </div>
            <button
              onClick={openAddModal}
              className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Discount Rule
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-2.5 px-3">Rule Name</th>
                  <th className="py-2.5 px-3">Scope / Target</th>
                  <th className="py-2.5 px-3 text-right">Discount %</th>
                  <th className="py-2.5 px-3 text-right">Min Order Qty</th>
                  <th className="py-2.5 px-3">Validity Period</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {rulesList.map(r => (
                  <tr key={r.id} className="hover:bg-brand-bg/60">
                    <td className="py-2.5 px-3 font-bold text-navy-DEFAULT">{r.name}</td>
                    <td className="py-2.5 px-3">
                      {r.rule_type === 'category_discount' ? (
                        <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-DEFAULT font-semibold text-[10px]">
                          Category: {r.category?.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[10px]">
                          SKU: {r.product?.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-brand-success">
                      {r.discount_percent}% OFF
                    </td>
                    <td className="py-2.5 px-3 text-right text-brand-textSecondary font-medium">
                      {r.min_quantity ? `${formatNumber(r.min_quantity)} units` : 'No Minimum'}
                    </td>
                    <td className="py-2.5 px-3 text-brand-textSecondary text-[11px]">
                      {formatDate(r.effective_from)} to {formatDate(r.effective_to) || 'Ongoing'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.is_active ? 'badge-success' : 'badge-error'}`}>
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1 text-brand-textSecondary hover:text-brand-error rounded hover:bg-red-50"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Rule */}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Configure Commercial Discount Rule"
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-3.5 text-xs">
            <div>
              <label className="label">Rule Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Monsoon HDPE Coil Special Discount"
                className="input-field text-xs"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Rule Scope *</label>
              <select
                className="input-field text-xs font-semibold"
                value={ruleType}
                onChange={e => setRuleType(e.target.value as PriceRule['rule_type'])}
              >
                <option value="category_discount">Category-Level Discount</option>
                <option value="product_discount">Product SKU Override</option>
              </select>
            </div>

            {ruleType === 'category_discount' ? (
              <div>
                <label className="label">Target Category</label>
                <select
                  className="input-field text-xs font-medium"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Target Product SKU</label>
                <select
                  className="input-field text-xs font-medium"
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Discount Percentage (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="5.0"
                  className="input-field text-xs font-bold text-brand-success"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Min Quantity Threshold</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 100"
                  className="input-field text-xs"
                  value={minQuantity}
                  onChange={e => setMinQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Effective From</label>
                <input
                  type="date"
                  className="input-field text-xs"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Effective To</label>
                <input
                  type="date"
                  className="input-field text-xs"
                  value={effectiveTo}
                  onChange={e => setEffectiveTo(e.target.value)}
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
                className="btn-primary py-2 text-xs font-bold"
              >
                Save Discount Rule
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  )
}
