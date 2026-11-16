import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Clock, Truck, Users, AlertTriangle, ArrowLeftRight,
  Warehouse as WarehouseIcon, TrendingUp, ChevronRight, PlusCircle,
  ArrowDownLeft, ArrowUpRight, Gauge, BarChart2, BookOpen, Tag,
  CheckCircle2, CheckSquare, Calendar, Filter, FileSpreadsheet, Search, Eye
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import {
  getProducts, getAllEmployees, getStockBalances, getMovements,
  getWarehouses, getDeliveries, getInwardEntries
} from '../../lib/dataService'
import { formatDate, formatNumber, getUnitLabel } from '../../lib/utils'

export default function AdminDashboard() {
  const navigate = useNavigate()

  const products = useMemo(() => getProducts(), [])
  const staff = useMemo(() => getAllEmployees(), [])
  const balances = useMemo(() => getStockBalances(), [])
  const movements = useMemo(() => getMovements(), [])
  const warehouses = useMemo(() => getWarehouses(), [])
  const deliveries = useMemo(() => getDeliveries(), [])
  const inwardEntries = useMemo(() => getInwardEntries(), [])

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const yesterdayStr = useMemo(() => new Date(Date.now() - 86400000).toISOString().split('T')[0], [])
  const sevenDaysAgoStr = useMemo(() => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0], [])

  // Daily Records Filters
  const [dateFilterPreset, setDateFilterPreset] = useState<'today' | 'yesterday' | 'week' | 'all' | 'custom'>('today')
  const [customDate, setCustomDate] = useState<string>('')
  const [txnTypeFilter, setTxnTypeFilter] = useState<'all' | 'inward' | 'outward'>('all')

  // 1. Total Opening Stock (Active SKU count & Unit-wise summary)
  const activeBalances = useMemo(() => balances.filter(b => b.quantity > 0), [balances])
  const activeSKUsCount = useMemo(() => {
    const s = new Set(activeBalances.map(b => b.product_id))
    return s.size
  }, [activeBalances])

  const unitStockSummary = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of activeBalances) {
      const u = b.product?.unit || 'piece'
      map[u] = (map[u] || 0) + b.quantity
    }
    return map
  }, [activeBalances])

  // 2. Today's Inward
  const todayInwardMovements = useMemo(() => {
    return movements.filter(m => {
      const isToday = m.created_at.startsWith(todayStr)
      return isToday && (m.movement_type === 'inward' || m.movement_type === 'transfer_in' || m.movement_type === 'return')
    })
  }, [movements, todayStr])

  const todayInwardCount = todayInwardMovements.length

  // 3. Today's Outward
  const todayOutwardMovements = useMemo(() => {
    return movements.filter(m => {
      const isToday = m.created_at.startsWith(todayStr)
      return isToday && (m.movement_type === 'outward' || m.movement_type === 'transfer_out')
    })
  }, [movements, todayStr])

  const todayOutwardCount = todayOutwardMovements.length

  // 4. Deliveries Awaiting Vehicle Return
  const awaitingReturnDeliveries = useMemo(() => {
    return deliveries.filter(d => d.status === 'awaiting_return')
  }, [deliveries])

  // Low stock products
  const lowStockAlerts = useMemo(() => {
    return products.filter(p => {
      if (!p.min_stock_threshold || !p.is_active) return false
      const totalStock = balances
        .filter(b => b.product_id === p.id)
        .reduce((sum, b) => sum + b.quantity, 0)
      return totalStock < p.min_stock_threshold
    })
  }, [products, balances])

  // Warehouse summaries
  const warehouseSummaries = useMemo(() => {
    return warehouses.map(wh => {
      const whBalances = balances.filter(b => b.warehouse_id === wh.id)
      const skuCount = whBalances.filter(b => b.quantity > 0).length
      return {
        warehouse: wh,
        skuCount,
        balances: whBalances
      }
    })
  }, [warehouses, balances])

  // Unified Daily Inward & Outward Records
  const allDailyTransactions = useMemo(() => {
    const rows: {
      id: string
      date: string
      time: string
      isToday: boolean
      type: 'inward' | 'outward' | 'adjustment'
      reference: string
      challanOrDo: string
      partyName: string
      city: string
      productName: string
      sku: string
      quantity: number
      unit: string
      warehouseName: string
      warehouseCode: string
      vehicleNumber?: string
      driverName?: string
      distanceKm?: number | null
      availableStock: number
      status: string
    }[] = []

    for (const m of movements) {
      const isToday = m.created_at.startsWith(todayStr)
      const datePart = m.created_at.split('T')[0]
      const timePart = m.created_at.includes('T') ? m.created_at.split('T')[1].slice(0, 5) : '10:00'

      const matchingDel = deliveries.find(d => d.delivery_ref === m.reference_no || d.id === m.reference_no)
      const matchingInw = inwardEntries.find(i => i.reference_no === m.reference_no || i.id === m.reference_no)

      const wh = warehouses.find(w => w.id === m.warehouse_id)
      const prod = products.find(p => p.id === m.product_id)

      const curStock = balances.find(b => b.product_id === m.product_id && b.warehouse_id === m.warehouse_id)?.quantity || 0

      let txnType: 'inward' | 'outward' | 'adjustment' = 'inward'
      if (m.movement_type === 'outward' || m.movement_type === 'transfer_out') txnType = 'outward'
      else if ((m.movement_type as string) === 'adjustment') txnType = 'adjustment'

      rows.push({
        id: m.id,
        date: datePart,
        time: timePart,
        isToday,
        type: txnType,
        reference: m.reference_no,
        challanOrDo: m.challan_no || matchingDel?.do_number || matchingInw?.challan_no || '—',
        partyName: m.supplier_customer || matchingDel?.customer_name || matchingInw?.supplier_name || '—',
        city: matchingDel?.city || wh?.city || '—',
        productName: prod?.name || m.product?.name || '—',
        sku: prod?.sku || m.product?.sku || '—',
        quantity: m.quantity,
        unit: prod?.unit || m.product?.unit || 'piece',
        warehouseName: wh?.name || '—',
        warehouseCode: wh?.code || '—',
        vehicleNumber: matchingDel?.vehicle_registration_number,
        driverName: matchingDel?.driver_name,
        distanceKm: matchingDel?.distance_travelled,
        availableStock: curStock,
        status: m.status
      })
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  }, [movements, deliveries, inwardEntries, warehouses, products, balances, todayStr])

  // Filter transactions by date and type
  const filteredTransactions = useMemo(() => {
    return allDailyTransactions.filter(t => {
      // Date filter
      if (dateFilterPreset === 'today' && !t.isToday) return false
      if (dateFilterPreset === 'yesterday' && t.date !== yesterdayStr) return false
      if (dateFilterPreset === 'week' && t.date < sevenDaysAgoStr) return false
      if (dateFilterPreset === 'custom' && customDate && t.date !== customDate) return false

      // Type filter
      if (txnTypeFilter !== 'all' && t.type !== txnTypeFilter) return false

      return true
    })
  }, [allDailyTransactions, dateFilterPreset, customDate, txnTypeFilter, yesterdayStr, sevenDaysAgoStr])

  const totalInwardQty = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'inward').reduce((sum, t) => sum + t.quantity, 0)
  }, [filteredTransactions])

  const totalOutwardQty = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'outward').reduce((sum, t) => sum + t.quantity, 0)
  }, [filteredTransactions])

  return (
    <AdminLayout title="Inventory Executive Dashboard">
      <div className="space-y-6">
        {/* ============================================================ */}
        {/* FOUR PRIMARY SUMMARY CARDS REQUIRED BY SECTION 7             */}
        {/* 1. Total Opening Stock                                       */}
        {/* 2. Today's Inward                                            */}
        {/* 3. Today's Outward                                           */}
        {/* 4. Deliveries Awaiting Vehicle Return                        */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Opening Stock */}
          <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D]/40 transition-colors">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DCE5EB]/60">
              <span className="text-[11px] font-bold text-[#72869A] uppercase tracking-wider">
                1. Total Active Stock
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D827D] flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#102C42]">
              {activeSKUsCount} <span className="text-xs font-semibold text-[#72869A]">Active SKUs</span>
            </p>
            <p className="text-[11px] text-[#72869A] mt-1 mb-2.5">
              Across {warehouses.filter(warehouse => warehouse.is_active).length} active warehouses • Today
            </p>
            <div className="flex flex-wrap gap-1 pt-1 border-t border-[#DCE5EB]/50">
              {Object.entries(unitStockSummary).slice(0, 3).map(([u, q]) => (
                <span key={u} className="text-[10px] font-semibold bg-[#F4F7FA] text-[#102C42] px-2 py-0.5 rounded border border-[#DCE5EB]">
                  {formatNumber(q)} {getUnitLabel(u)}
                </span>
              ))}
            </div>
          </div>

          {/* Card 2: Today's Inward */}
          <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#16845B]/40 transition-colors">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DCE5EB]/60">
              <span className="text-[11px] font-bold text-[#16845B] uppercase tracking-wider flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4" /> 2. Today's Inward
              </span>
              <div className="w-8 h-8 rounded-xl bg-green-50 text-[#16845B] flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#16845B]">
              {todayInwardCount} <span className="text-xs font-semibold text-[#72869A]">Receipts</span>
            </p>
            <p className="text-[11px] text-[#72869A] mt-1">
              {inwardEntries.filter(e => e.entry_date === todayStr).length} factory shipments logged today
            </p>
            <div className="mt-3">
              <button
                onClick={() => navigate('/admin/inward')}
                className="text-[11px] font-bold text-[#0D827D] hover:underline flex items-center gap-1"
              >
                <span>View Inward History</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Today's Outward */}
          <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#DC4C4C]/40 transition-colors">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DCE5EB]/60">
              <span className="text-[11px] font-bold text-[#DC4C4C] uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4" /> 3. Today's Outward
              </span>
              <div className="w-8 h-8 rounded-xl bg-red-50 text-[#DC4C4C] flex items-center justify-center font-bold">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#DC4C4C]">
              {deliveries.filter(d => d.date === todayStr).length} <span className="text-xs font-semibold text-[#72869A]">Dispatches</span>
            </p>
            <p className="text-[11px] text-[#72869A] mt-1">
              Customer deliveries logged today
            </p>
            <div className="mt-3">
              <button
                onClick={() => navigate('/admin/deliveries')}
                className="text-[11px] font-bold text-[#0D827D] hover:underline flex items-center gap-1"
              >
                <span>Open Delivery Register</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 4: Deliveries Awaiting Vehicle Return */}
          <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-amber-400 transition-colors">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DCE5EB]/60">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <Gauge className="w-4 h-4" /> 4. Awaiting Return
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-[#102C42]">
              {awaitingReturnDeliveries.length} <span className="text-xs font-semibold text-amber-700">Vehicles Out</span>
            </p>
            <p className="text-[11px] text-[#72869A] mt-1">
              Awaiting Vehicle Return KM input
            </p>
            <div className="mt-3">
              <button
                onClick={() => navigate('/admin/deliveries?status=awaiting_return')}
                className="text-[11px] font-bold text-[#0D827D] hover:underline flex items-center gap-1"
              >
                <span>View Dispatches</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SHORTCUTS ROW REQUIRED BY SECTION 7                         */}
        {/* Products, Categories, Inward, Deliveries, Stock, Vehicles... */}
        {/* ============================================================ */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
          <p className="text-[11px] font-bold text-[#72869A] uppercase tracking-wider mb-3">
            Quick Operational Shortcuts
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            <button
              onClick={() => navigate('/admin/stock-report')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#0D827D]/40 bg-[#E7F3F1] hover:bg-[#0D827D] hover:text-white transition-colors group text-center"
            >
              <FileSpreadsheet className="w-5 h-5 text-[#0D827D] group-hover:text-white mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-white">Current Stock</span>
              <span className="text-[10px] text-[#0D827D] group-hover:text-white/80">Excel Valuation</span>
            </button>

            <button
              onClick={() => navigate('/admin/deliveries')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <Truck className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Deliveries</span>
              <span className="text-[10px] text-[#72869A]">{deliveries.length} Records</span>
            </button>

            <button
              onClick={() => navigate('/admin/inward')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <ArrowDownLeft className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Inward Entries</span>
              <span className="text-[10px] text-[#72869A]">Factory Goods</span>
            </button>

            <button
              onClick={() => navigate('/admin/vehicles')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <Gauge className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Vehicles</span>
              <span className="text-[10px] text-[#72869A]">Fleet & PUC</span>
            </button>

            <button
              onClick={() => navigate('/admin/products')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <Package className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Products</span>
              <span className="text-[10px] text-[#72869A]">{products.length} SKUs</span>
            </button>

            <button
              onClick={() => navigate('/admin/stock-ledger')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <BookOpen className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Stock Records</span>
              <span className="text-[10px] text-[#72869A]">Ledger Balances</span>
            </button>

            <button
              onClick={() => navigate('/admin/staff')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <Users className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Staff & Drivers</span>
              <span className="text-[10px] text-[#72869A]">{staff.length} Active</span>
            </button>

            <button
              onClick={() => navigate('/admin/reports')}
              className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#DCE5EB] bg-[#F4F7FA]/70 hover:bg-[#E7F3F1] hover:border-[#0D827D] transition-colors group text-center"
            >
              <BarChart2 className="w-5 h-5 text-[#0D827D] mb-1.5" />
              <span className="text-xs font-bold text-[#102C42] group-hover:text-[#0D827D]">Reports</span>
              <span className="text-[10px] text-[#72869A]">Excel / PDF</span>
            </button>
          </div>
        </div>

        {/* Deliveries Awaiting Vehicle Return List */}
        {awaitingReturnDeliveries.length > 0 && (
          <div className="card p-5 border border-amber-200 bg-amber-50/30 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#102C42]">Deliveries Currently Dispatched & Awaiting Vehicle Return</h2>
                  <p className="text-[11px] text-[#72869A]">Vehicle Return KM is recorded exclusively by Godown Staff upon return to yard</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/admin/deliveries?status=awaiting_return')}
                className="text-xs font-bold text-[#0D827D] hover:underline"
              >
                View Delivery Register &rarr;
              </button>
            </div>

            <div className="space-y-2">
              {awaitingReturnDeliveries.map(del => (
                <div
                  key={del.id}
                  className="p-3 bg-white rounded-xl border border-[#DCE5EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                        {del.delivery_ref}
                      </span>
                      <span className="text-xs font-bold text-[#102C42]">{del.customer_name}</span>
                      <span className="text-xs text-[#72869A]">({del.city})</span>
                    </div>
                    <p className="text-[11px] text-[#72869A] mt-0.5">
                      Vehicle: <strong className="text-[#102C42]">{del.vehicle_registration_number}</strong> • Driver: {del.driver_name} • Out KM: <strong className="text-[#102C42]">{formatNumber(del.vehicle_out_km)}</strong>
                    </p>
                  </div>

                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl self-start sm:self-auto flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>In Transit (Staff Logs Return)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* DAILY INWARD & OUTWARD STOCK RECORDS REGISTER               */}
        {/* ============================================================ */}
        <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#DCE5EB]">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D827D] flex items-center justify-center font-bold">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#102C42]">Daily Inward & Outward Stock Register</h2>
                  <p className="text-xs text-[#72869A]">
                    Live ledger of today's and historical goods arrivals, dispatches, and available yard stock.
                  </p>
                </div>
              </div>
            </div>

            {/* Date Filters Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-[#F4F7FA] p-1 border border-[#DCE5EB] text-xs">
                <button
                  onClick={() => setDateFilterPreset('today')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${dateFilterPreset === 'today' ? 'bg-[#0D827D] text-white shadow-xs' : 'text-[#72869A] hover:text-[#102C42]'}`}
                >
                  ⚡ Today
                </button>
                <button
                  onClick={() => setDateFilterPreset('yesterday')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${dateFilterPreset === 'yesterday' ? 'bg-[#0D827D] text-white shadow-xs' : 'text-[#72869A] hover:text-[#102C42]'}`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setDateFilterPreset('week')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${dateFilterPreset === 'week' ? 'bg-[#0D827D] text-white shadow-xs' : 'text-[#72869A] hover:text-[#102C42]'}`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setDateFilterPreset('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${dateFilterPreset === 'all' ? 'bg-[#0D827D] text-white shadow-xs' : 'text-[#72869A] hover:text-[#102C42]'}`}
                >
                  All Records
                </button>
              </div>

              {/* Custom Date Picker */}
              <div className="flex items-center gap-1.5 bg-[#F4F7FA] border border-[#DCE5EB] rounded-xl px-2.5 py-1">
                <Calendar className="w-3.5 h-3.5 text-[#72869A]" />
                <input
                  type="date"
                  value={customDate}
                  onChange={e => {
                    setCustomDate(e.target.value)
                    if (e.target.value) setDateFilterPreset('custom')
                  }}
                  className="bg-transparent text-xs text-[#102C42] font-semibold focus:outline-none"
                />
              </div>

              {/* Movement Type Filter */}
              <select
                value={txnTypeFilter}
                onChange={e => setTxnTypeFilter(e.target.value as any)}
                className="input-field text-xs py-1.5 px-2.5 w-32 font-semibold"
              >
                <option value="all">All Types</option>
                <option value="inward">Inward Only</option>
                <option value="outward">Outward Only</option>
              </select>
            </div>
          </div>

          {/* Quick Metrics Bar for Selected Filter */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F4F7FA] border border-[#DCE5EB]">
              <span className="text-[10px] text-[#72869A] uppercase font-bold block">Filtered Records</span>
              <strong className="text-lg text-[#102C42]">{filteredTransactions.length} Movements</strong>
            </div>
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-[#16845B]">
              <span className="text-[10px] uppercase font-bold block">Total Inward Qty</span>
              <strong className="text-lg">+{formatNumber(totalInwardQty)} Units</strong>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#DC4C4C]">
              <span className="text-[10px] uppercase font-bold block">Total Outward Qty</span>
              <strong className="text-lg">−{formatNumber(totalOutwardQty)} Units</strong>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-[#0D827D]">
              <span className="text-[10px] uppercase font-bold block">Net Movement</span>
              <strong className="text-lg">
                {totalInwardQty - totalOutwardQty >= 0 ? '+' : ''}{formatNumber(totalInwardQty - totalOutwardQty)} Units
              </strong>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="border border-[#DCE5EB] rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="bg-[#F4F7FA] text-[#72869A] text-[10px] uppercase font-bold sticky top-0 border-b border-[#DCE5EB] z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Ref / Challan</th>
                    <th className="py-2.5 px-3">Customer / Supplier</th>
                    <th className="py-2.5 px-3">Product SKU & Name</th>
                    <th className="py-2.5 px-3 text-right">Movement Qty</th>
                    <th className="py-2.5 px-3">Yard / Godown</th>
                    <th className="py-2.5 px-3">Vehicle / Trip</th>
                    <th className="py-2.5 px-3 text-right">Avail. Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EB]">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {t.isToday ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#0D827D] bg-[#E7F3F1] px-2 py-0.5 rounded-md border border-[#0D827D]/30">
                              ⚡ Today • {t.time}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#72869A] bg-[#F4F7FA] px-2 py-0.5 rounded-md border border-[#DCE5EB]">
                              📅 {t.date}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {t.type === 'inward' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16845B] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              <ArrowDownLeft className="w-3 h-3" /> INWARD
                            </span>
                          ) : t.type === 'outward' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#DC4C4C] bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <ArrowUpRight className="w-3 h-3" /> OUTWARD
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                              ADJUSTMENT
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <p className="font-mono font-bold text-[#102C42]">{t.reference}</p>
                          <p className="text-[10px] text-[#72869A]">Doc: {t.challanOrDo}</p>
                        </td>

                        <td className="py-2.5 px-3">
                          <p className="font-bold text-[#102C42]">{t.partyName}</p>
                          <p className="text-[10px] text-[#72869A]">{t.city}</p>
                        </td>

                        <td className="py-2.5 px-3 max-w-xs">
                          <p className="font-mono text-[10px] text-[#72869A] font-bold">{t.sku}</p>
                          <p className="font-semibold text-[#102C42] truncate">{t.productName}</p>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <strong className={`font-mono text-xs ${t.type === 'inward' ? 'text-[#16845B]' : 'text-[#DC4C4C]'}`}>
                            {t.type === 'inward' ? '+' : '−'}{formatNumber(t.quantity)} {getUnitLabel(t.unit)}
                          </strong>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] font-semibold text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                            {t.warehouseCode}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {t.vehicleNumber ? (
                            <div>
                              <p className="font-mono font-bold text-[#102C42] text-[11px]">{t.vehicleNumber}</p>
                              <p className="text-[10px] text-[#72869A]">{t.driverName} {t.distanceKm ? `(${t.distanceKm} km)` : ''}</p>
                            </div>
                          ) : (
                            <span className="text-[#72869A] text-[11px]">Direct Yard Unload</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-[#102C42]">
                          {formatNumber(t.availableStock)} {getUnitLabel(t.unit)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#72869A]">
                        No stock records found for the selected date filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Low Stock Reorder Alerts */}
        <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Low-Stock Reorder Alerts</span>
            </h2>
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {lowStockAlerts.length} Products Low
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockAlerts.slice(0, 6).map(prod => {
              const currentStock = balances
                .filter(b => b.product_id === prod.id)
                .reduce((sum, b) => sum + b.quantity, 0)

              return (
                <div key={prod.id} className="p-3 rounded-xl border border-red-100 bg-red-50/30 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-bold text-[#72869A]">{prod.sku}</span>
                    <span className="text-[10px] text-red-600 font-bold">Below Threshold</span>
                  </div>
                  <p className="text-xs font-bold text-[#102C42] truncate">{prod.name}</p>
                  <p className="text-xs text-[#DC4C4C] font-extrabold">
                    {formatNumber(currentStock)} / {formatNumber(prod.min_stock_threshold || 0)} {getUnitLabel(prod.unit)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Godown & Location Stock Balances */}
        <div>
          <h2 className="text-xs font-bold text-[#72869A] uppercase tracking-wider mb-3 px-1">
            Godown & Location Stock Balances
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {warehouseSummaries.map(({ warehouse, skuCount, balances }) => {
              return (
                <div
                  key={warehouse.id}
                  onClick={() => navigate('/admin/stock-ledger')}
                  className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm hover:border-[#0D827D] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#DCE5EB]/60">
                    <div>
                      <p className="text-xs font-bold text-[#102C42]">{warehouse.name}</p>
                      <p className="text-[10px] text-[#72869A]">{warehouse.city}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-[#F4F7FA] text-[#102C42] px-2 py-0.5 rounded border border-[#DCE5EB]">
                      {warehouse.code}
                    </span>
                  </div>
                  <p className="text-lg font-extrabold text-[#102C42]">
                    {skuCount} <span className="text-xs font-semibold text-[#72869A]">Active SKUs in Yard</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
