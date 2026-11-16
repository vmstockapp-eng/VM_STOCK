import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, FileSpreadsheet, Download, Calendar, Filter, Search,
  Warehouse as WarehouseIcon, Package, Users, ClipboardCheck, ArrowLeftRight
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import {
  getDailyReports, getMovements, getPhysicalCounts, getAllEmployees,
  getWarehouses, getCategories, getProducts
} from '../../lib/dataService'
import { formatDate, formatNumber, getStatusColor, getUnitLabel } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

type ReportType = 'daily_register' | 'movement_ledger' | 'physical_verification' | 'staff_activity'

export default function AdminReports() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [activeReport, setActiveReport] = useState<ReportType>('daily_register')
  const warehouses = useMemo(() => getWarehouses(), [])
  const categories = useMemo(() => getCategories(), [])
  const products = useMemo(() => getProducts(), [])
  const staff = useMemo(() => getAllEmployees(), [])

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [staffFilter, setStaffFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Report 1: Daily Stock Register Lines
  const dailyRegisterData = useMemo(() => {
    const allReports = getDailyReports(warehouseFilter === 'all' ? undefined : warehouseFilter)
    const rows: any[] = []

    for (const r of allReports) {
      if (staffFilter !== 'all' && r.created_by !== staffFilter) continue
      for (const line of r.lines || []) {
        if (categoryFilter !== 'all' && line.category_id !== categoryFilter) continue
        if (search && !line.product?.name.toLowerCase().includes(search.toLowerCase()) && !line.product?.sku.toLowerCase().includes(search.toLowerCase())) continue

        rows.push({
          report_id: r.id,
          date: r.report_date,
          warehouse: r.warehouse?.name || 'Central',
          sku: line.product?.sku || '-',
          product_name: line.product?.name || 'Product',
          category: categories.find(c => c.id === line.category_id)?.name || '-',
          unit: line.product?.unit || 'piece',
          opening: line.opening_stock,
          inward: line.inward_qty,
          outward: line.outward_qty,
          closing: line.closing_stock,
          status: r.status,
          creator: r.creator_name || '-'
        })
      }
    }
    return rows
  }, [warehouseFilter, categoryFilter, staffFilter, search, categories])

  // Report 2: Movements
  const movementsData = useMemo(() => {
    return getMovements({
      warehouseId: warehouseFilter === 'all' ? undefined : warehouseFilter
    }).filter(m => {
      const matchCat = categoryFilter === 'all' || m.product?.category_id === categoryFilter
      const matchStaff = staffFilter === 'all' || m.created_by === staffFilter
      const matchSearch = !search || m.reference_no.toLowerCase().includes(search.toLowerCase()) ||
                          (m.product?.name && m.product.name.toLowerCase().includes(search.toLowerCase()))
      return matchCat && matchStaff && matchSearch
    })
  }, [warehouseFilter, categoryFilter, staffFilter, search])

  // Report 3: Physical Verification
  const physicalVerificationData = useMemo(() => {
    const counts = getPhysicalCounts(warehouseFilter === 'all' ? undefined : warehouseFilter)
    const rows: any[] = []
    for (const c of counts) {
      if (staffFilter !== 'all' && c.created_by !== staffFilter) continue
      for (const l of c.lines || []) {
        if (search && !l.product?.name.toLowerCase().includes(search.toLowerCase()) && !l.product?.sku.toLowerCase().includes(search.toLowerCase())) continue
        rows.push({
          reference: c.reference_no,
          date: c.count_date,
          warehouse: c.warehouse?.name || 'Central',
          sku: l.product?.sku || '-',
          product_name: l.product?.name || '-',
          unit: l.product?.unit || 'piece',
          system: l.system_stock,
          counted: l.counted_stock,
          variance: l.variance,
          notes: l.notes || '-',
          status: c.status,
          counted_by: c.creator_name
        })
      }
    }
    return rows
  }, [warehouseFilter, staffFilter, search])

  // Report 4: Staff Activity
  const staffActivityData = useMemo(() => {
    const allReports = getDailyReports(warehouseFilter === 'all' ? undefined : warehouseFilter)
    return allReports.filter(r => {
      const matchStaff = staffFilter === 'all' || r.created_by === staffFilter
      const matchSearch = !search || (r.creator_name && r.creator_name.toLowerCase().includes(search.toLowerCase()))
      return matchStaff && matchSearch
    }).map(r => ({
      report_id: r.id,
      date: r.report_date,
      staff_name: r.creator_name || '-',
      warehouse: r.warehouse?.name || 'Central',
      categories_count: new Set((r.lines || []).map(l => l.category_id)).size,
      products_count: r.lines?.length || 0,
      status: r.status,
      submitted_at: r.submitted_at ? formatDate(r.submitted_at) : 'Draft'
    }))
  }, [warehouseFilter, staffFilter, search])

  // Unit Breakdown Totals for Daily Register (without combining incompatible units!)
  const unitTotals = useMemo(() => {
    const map: Record<string, { opening: number; inward: number; outward: number; closing: number }> = {}
    for (const row of dailyRegisterData) {
      const u = row.unit
      if (!map[u]) map[u] = { opening: 0, inward: 0, outward: 0, closing: 0 }
      map[u].opening += row.opening
      map[u].inward += row.inward
      map[u].outward += row.outward
      map[u].closing += row.closing
    }
    return map
  }, [dailyRegisterData])

  // Export handlers
  const handleExportCSV = () => {
    let dataToExport: any[] = []
    let filename = `StockFlow_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`

    if (activeReport === 'daily_register') dataToExport = dailyRegisterData
    else if (activeReport === 'movement_ledger') dataToExport = movementsData
    else if (activeReport === 'physical_verification') dataToExport = physicalVerificationData
    else dataToExport = staffActivityData

    const csv = Papa.unparse(dataToExport)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('success', 'CSV Exported', `${activeReport} downloaded.`)
  }

  const handleExportExcel = () => {
    let dataToExport: any[] = []
    let sheetName = 'Report'

    if (activeReport === 'daily_register') {
      dataToExport = dailyRegisterData
      sheetName = 'Daily Stock Register'
    } else if (activeReport === 'movement_ledger') {
      dataToExport = movementsData.map(m => ({
        Ref: m.reference_no,
        Date: formatDate(m.created_at),
        Location: m.warehouse?.name,
        SKU: m.product?.sku,
        Product: m.product?.name,
        Type: m.movement_type,
        Quantity: m.quantity,
        Unit: m.product?.unit,
        Status: m.status
      }))
      sheetName = 'Movement Ledger'
    } else if (activeReport === 'physical_verification') {
      dataToExport = physicalVerificationData
      sheetName = 'Physical Verification'
    } else {
      dataToExport = staffActivityData
      sheetName = 'Staff Activity'
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, `StockFlow_${activeReport}_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast('success', 'Excel (.XLSX) Exported', `${sheetName} generated successfully.`)
  }

  return (
    <AdminLayout title="Operational & Inventory Reports">
      <div className="space-y-4">
        {/* Current Stock Valuation Parity Banner */}
        <div className="card p-4 rounded-2xl border-2 border-[#0D827D]/40 bg-[#E7F3F1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0D827D] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-white bg-[#0D827D] px-2 py-0.5 rounded">
                  LIVE INVENTORY
                </span>
                <span className="text-xs font-bold text-[#102C42]">Current Stock Valuation Report</span>
              </div>
              <p className="text-xs text-[#20384A] mt-0.5">
                Valuation from the current product catalog, active price rules, and stock balances.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/stock-report')}
            className="btn-primary py-2 px-4 text-xs font-bold whitespace-nowrap self-start sm:self-auto shadow-sm"
          >
            Open Current Stock Report &rarr;
          </button>
        </div>

        {/* Report Category Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <button
            onClick={() => setActiveReport('daily_register')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              activeReport === 'daily_register'
                ? 'bg-teal-DEFAULT text-white border-teal-DEFAULT shadow-md'
                : 'bg-white text-brand-textPrimary border-brand-border hover:border-teal-DEFAULT'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="font-bold text-xs uppercase tracking-wider">1. Daily Register</span>
            </div>
            <p className={`text-[11px] truncate ${activeReport === 'daily_register' ? 'text-teal-100' : 'text-brand-textSecondary'}`}>
              Opening, inward, outward, closing
            </p>
          </button>

          <button
            onClick={() => setActiveReport('movement_ledger')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              activeReport === 'movement_ledger'
                ? 'bg-teal-DEFAULT text-white border-teal-DEFAULT shadow-md'
                : 'bg-white text-brand-textPrimary border-brand-border hover:border-teal-DEFAULT'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ArrowLeftRight className="w-4 h-4" />
              <span className="font-bold text-xs uppercase tracking-wider">2. Movement Ledger</span>
            </div>
            <p className={`text-[11px] truncate ${activeReport === 'movement_ledger' ? 'text-teal-100' : 'text-brand-textSecondary'}`}>
              Receipts, dispatches, transfers
            </p>
          </button>

          <button
            onClick={() => setActiveReport('physical_verification')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              activeReport === 'physical_verification'
                ? 'bg-teal-DEFAULT text-white border-teal-DEFAULT shadow-md'
                : 'bg-white text-brand-textPrimary border-brand-border hover:border-teal-DEFAULT'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="w-4 h-4" />
              <span className="font-bold text-xs uppercase tracking-wider">3. Physical Audits</span>
            </div>
            <p className={`text-[11px] truncate ${activeReport === 'physical_verification' ? 'text-teal-100' : 'text-brand-textSecondary'}`}>
              Counted vs system stock variances
            </p>
          </button>

          <button
            onClick={() => setActiveReport('staff_activity')}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              activeReport === 'staff_activity'
                ? 'bg-teal-DEFAULT text-white border-teal-DEFAULT shadow-md'
                : 'bg-white text-brand-textPrimary border-brand-border hover:border-teal-DEFAULT'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4" />
              <span className="font-bold text-xs uppercase tracking-wider">4. Staff Activity</span>
            </div>
            <p className={`text-[11px] truncate ${activeReport === 'staff_activity' ? 'text-teal-100' : 'text-brand-textSecondary'}`}>
              Staff-wise submissions & sign-offs
            </p>
          </button>
        </div>

        {/* Global Report Filters Bar */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search within report..."
                className="input-field pl-9 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 text-teal-DEFAULT" /> Export CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" /> Export Excel (.XLSX)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-brand-border/60">
            <div>
              <label className="label">Filter Warehouse</label>
              <select
                className="input-field text-xs font-medium"
                value={warehouseFilter}
                onChange={e => setWarehouseFilter(e.target.value)}
              >
                <option value="all">All Locations</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Filter Category</label>
              <select
                className="input-field text-xs font-medium"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Filter Staff Member</label>
              <select
                className="input-field text-xs font-medium"
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
              >
                <option value="all">All Staff Members</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grand Unit Totals Bar (Only for Daily Register) */}
        {activeReport === 'daily_register' && Object.keys(unitTotals).length > 0 && (
          <div className="card p-3.5 bg-gradient-to-r from-navy-DEFAULT to-navy-800 text-white rounded-2xl shadow-card">
            <span className="text-[10px] uppercase font-bold text-teal-100 tracking-wider block mb-2">
              Unit-Wise Grand Totals (Units Kept Separately — No Mixing)
            </span>
            <div className="flex flex-wrap gap-4 text-xs">
              {Object.entries(unitTotals).map(([u, totals]) => (
                <div key={u} className="bg-navy-700/80 px-3 py-2 rounded-xl border border-navy-600/60 min-w-[140px]">
                  <span className="font-bold text-teal-100 capitalize block mb-0.5">{getUnitLabel(u)}</span>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between text-navy-100">
                      <span>Inward:</span>
                      <span className="font-semibold text-green-300">+{formatNumber(totals.inward)}</span>
                    </div>
                    <div className="flex justify-between text-navy-100">
                      <span>Outward:</span>
                      <span className="font-semibold text-red-300">−{formatNumber(totals.outward)}</span>
                    </div>
                    <div className="flex justify-between border-t border-navy-600/60 pt-0.5 text-white font-bold">
                      <span>Closing:</span>
                      <span>{formatNumber(totals.closing)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Data Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="overflow-x-auto">
            {activeReport === 'daily_register' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                  <tr>
                    <th className="py-3 px-4">Date / Location</th>
                    <th className="py-3 px-4">Product SKU & Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Opening</th>
                    <th className="py-3 px-4 text-right">Inward</th>
                    <th className="py-3 px-4 text-right">Outward</th>
                    <th className="py-3 px-4 text-right font-bold text-teal-DEFAULT">Closing Stock</th>
                    <th className="py-3 px-4">Logged By</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {dailyRegisterData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-brand-bg/60">
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-navy-DEFAULT block">{formatDate(row.date)}</span>
                        <span className="text-[10px] text-brand-textSecondary">{row.warehouse}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-navy-DEFAULT block">{row.sku}</span>
                        <span className="text-[11px] text-brand-textSecondary truncate max-w-[160px] block">{row.product_name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{row.category}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{formatNumber(row.opening)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-brand-success">+{formatNumber(row.inward)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-brand-error">−{formatNumber(row.outward)}</td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-navy-DEFAULT">
                        {formatNumber(row.closing)} <span className="text-[10px] font-normal text-brand-textSecondary">{getUnitLabel(row.unit)}</span>
                      </td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{row.creator}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'movement_ledger' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                  <tr>
                    <th className="py-3 px-4">Ref No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Godown</th>
                    <th className="py-3 px-4">Product SKU</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Challan / Party</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {movementsData.map(m => (
                    <tr key={m.id} className="hover:bg-brand-bg/60">
                      <td className="py-2.5 px-4 font-bold text-navy-DEFAULT">{m.reference_no}</td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{formatDate(m.created_at)}</td>
                      <td className="py-2.5 px-4 font-medium text-navy-DEFAULT">{m.warehouse?.name}</td>
                      <td className="py-2.5 px-4 font-bold">{m.product?.sku}</td>
                      <td className="py-2.5 px-4 uppercase font-bold text-[10px] text-teal-DEFAULT">{m.movement_type}</td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-navy-DEFAULT">
                        {formatNumber(m.quantity)} {getUnitLabel(m.product?.unit)}
                      </td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{m.supplier_customer || m.challan_no || '-'}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(m.status)}`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'physical_verification' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                  <tr>
                    <th className="py-3 px-4">Ref / Date</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Product SKU & Name</th>
                    <th className="py-3 px-4 text-right">System Expected</th>
                    <th className="py-3 px-4 text-right">Physically Counted</th>
                    <th className="py-3 px-4 text-right">Variance</th>
                    <th className="py-3 px-4">Auditor Notes</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {physicalVerificationData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-brand-bg/60">
                      <td className="py-2.5 px-4 font-bold text-navy-DEFAULT">
                        {row.reference}
                        <span className="block text-[10px] text-brand-textSecondary font-normal">{formatDate(row.date)}</span>
                      </td>
                      <td className="py-2.5 px-4 font-medium">{row.warehouse}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-navy-DEFAULT block">{row.sku}</span>
                        <span className="text-[11px] text-brand-textSecondary truncate max-w-[160px] block">{row.product_name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-brand-textSecondary">{formatNumber(row.system)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-navy-DEFAULT">{formatNumber(row.counted)}</td>
                      <td className="py-2.5 px-4 text-right font-extrabold">
                        <span className={row.variance < 0 ? 'text-brand-error' : row.variance > 0 ? 'text-blue-700' : 'text-brand-success'}>
                          {row.variance > 0 ? `+${formatNumber(row.variance)}` : formatNumber(row.variance)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-brand-textSecondary">{row.notes}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeReport === 'staff_activity' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Report Date</th>
                    <th className="py-3 px-4">Godown</th>
                    <th className="py-3 px-4 text-center">Categories Finished</th>
                    <th className="py-3 px-4 text-center">SKUs Logged</th>
                    <th className="py-3 px-4 text-center">Approval Status</th>
                    <th className="py-3 px-4">Submission Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/60">
                  {staffActivityData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-brand-bg/60">
                      <td className="py-2.5 px-4 font-bold text-navy-DEFAULT">{row.staff_name}</td>
                      <td className="py-2.5 px-4 font-medium text-brand-textPrimary">{formatDate(row.date)}</td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{row.warehouse}</td>
                      <td className="py-2.5 px-4 text-center font-bold text-teal-DEFAULT">{row.categories_count} Cats</td>
                      <td className="py-2.5 px-4 text-center font-bold text-navy-DEFAULT">{row.products_count} SKUs</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-brand-textSecondary">{row.submitted_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
