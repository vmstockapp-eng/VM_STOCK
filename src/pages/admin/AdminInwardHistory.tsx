import React, { useState, useMemo, useEffect } from 'react'
import {
  ArrowDownLeft, Search, Warehouse, Eye,
  CheckCircle2, Clock, Package, X
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { getInwardEntries, getWarehouses, getCategories } from '../../lib/dataService'
import type { InwardStockEntry } from '../../types'
import { formatDate, formatNumber, getUnitLabel } from '../../lib/utils'

export default function AdminInwardHistory() {
  const [inwardList, setInwardList] = useState<InwardStockEntry[]>(() => getInwardEntries())
  const warehouses = useMemo(() => getWarehouses(), [])
  const categories = useMemo(() => getCategories(), [])

  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState<InwardStockEntry | null>(null)

  useEffect(() => {
    const refresh = () => setInwardList(getInwardEntries())
    window.addEventListener('stockflow:data-updated', refresh)
    return () => window.removeEventListener('stockflow:data-updated', refresh)
  }, [])

  const filteredEntries = useMemo(() => {
    let list = inwardList

    if (warehouseFilter !== 'all') {
      list = list.filter(e => e.warehouse_id === warehouseFilter)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e =>
        e.reference_no.toLowerCase().includes(q) ||
        e.challan_no.toLowerCase().includes(q) ||
        e.supplier_name.toLowerCase().includes(q) ||
        (e.creator_name && e.creator_name.toLowerCase().includes(q))
      )
    }

    return list
  }, [inwardList, search, warehouseFilter])

  return (
    <AdminLayout title="Inward Stock History">
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#102C42]">Inward Goods & Factory Receipts</h1>
            <p className="text-xs text-[#72869A]">
              Audit trail of all incoming pipe, fitting, and tank consignments received at godowns.
            </p>
          </div>
          <span className="text-xs font-bold bg-[#E7F3F1] text-[#0D827D] px-3 py-1 rounded-xl border border-[#0D827D]/30 self-start sm:self-auto">
            {inwardList.length} Total Consignments
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#72869A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ref no, challan, supplier..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-[#72869A] font-semibold">Godown:</span>
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="input-field text-xs py-1.5 w-full sm:w-44 font-semibold"
            >
              <option value="all">All Godowns</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Inward Entries Table */}
        <div className="card p-0 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-[#E7F3F1] border-b border-[#DCE5EB] text-[#72869A] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Entry Reference</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Challan / Invoice No.</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Godown</th>
                  <th className="py-3 px-4">Categories & Lines</th>
                  <th className="py-3 px-4">Entered By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EB]">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map(entry => {
                    const activeLines = entry.lines.filter(l => l.quantity > 0)
                    const uniqueCatIds = Array.from(new Set(activeLines.map(l => l.category_id)))
                    const catNames = uniqueCatIds
                      .map(id => categories.find(c => c.id === id)?.name || id)
                      .join(', ')

                    return (
                      <tr key={entry.id} className="hover:bg-[#F4F7FA]/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#102C42]">
                          {entry.reference_no}
                        </td>

                        <td className="py-3.5 px-4 text-[#72869A]">
                          {formatDate(entry.entry_date, 'dd MMM yyyy')}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#102C42]">
                          {entry.challan_no}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-[#102C42]">
                          {entry.supplier_name}
                        </td>

                        <td className="py-3.5 px-4 text-[#72869A]">
                          {entry.warehouse?.name || 'Main Yard'}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#102C42]">{catNames || 'Standard Material'}</p>
                          <p className="text-[11px] text-[#72869A]">{activeLines.length} product lines</p>
                        </td>

                        <td className="py-3.5 px-4 text-[#72869A]">
                          {entry.creator_name || 'Staff User'}
                        </td>

                        <td className="py-3.5 px-4">
                          {entry.status === 'saved' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-[#16845B] border border-green-200">
                              <CheckCircle2 className="w-3 h-3" /> Saved (Posted)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#72869A] border border-slate-300">
                              Draft
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1.5 text-[#102C42] hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Inward Breakdown"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#72869A]">
                      No inward entries found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inward Details Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                <div>
                  <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-[#0D827D]" />
                    <span>Inward Receipt Breakdown — {selectedEntry.reference_no}</span>
                  </h2>
                  <p className="text-[11px] text-[#72869A]">{selectedEntry.supplier_name} • Challan: {selectedEntry.challan_no}</p>
                </div>
                <button onClick={() => setSelectedEntry(null)} className="p-1 text-[#72869A] hover:text-[#102C42]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] text-xs">
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Date</span>
                    <span className="font-bold text-[#102C42]">{formatDate(selectedEntry.entry_date, 'dd MMM yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Challan / Invoice</span>
                    <span className="font-mono font-bold text-[#102C42]">{selectedEntry.challan_no}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Godown</span>
                    <span className="font-bold text-[#102C42]">{selectedEntry.warehouse?.name || 'Godown'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Recorded By</span>
                    <span className="font-bold text-[#102C42]">{selectedEntry.creator_name || 'Staff'}</span>
                  </div>
                </div>

                {/* Product Lines Grouped by Category */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#102C42] uppercase tracking-wider">
                    Received Product Lines
                  </h3>

                  <div className="rounded-xl border border-[#DCE5EB] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#E7F3F1] text-[#72869A] uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3 text-right">Received Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE5EB]">
                        {selectedEntry.lines.filter(l => l.quantity > 0).map(line => (
                          <tr key={line.id}>
                            <td className="py-2.5 px-3 font-semibold text-[#102C42]">
                              {line.product?.name || 'Product'}
                            </td>
                            <td className="py-2.5 px-3 text-[#72869A] font-mono">
                              {line.product?.sku || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-[#16845B]">
                              +{formatNumber(line.quantity)} {line.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedEntry.notes && (
                  <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] text-xs">
                    <strong className="text-[#102C42] block mb-0.5">Notes:</strong>
                    <p className="text-[#72869A]">{selectedEntry.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
