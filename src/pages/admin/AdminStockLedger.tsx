import React, { useState, useMemo } from 'react'
import {
  BookOpen, Search, Filter, Download, ArrowDownLeft, ArrowUpRight,
  Warehouse as WarehouseIcon, Calendar, User, Package
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { getMovements, getWarehouses, getCategories, getProducts, getStockBalances } from '../../lib/dataService'
import { formatDate, formatDateTime, formatNumber, getStatusColor, getUnitLabel } from '../../lib/utils'
import type { MovementType, StockMovement } from '../../types'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useToast } from '../../store/ToastContext'

export default function AdminStockLedger() {
  const { toast } = useToast()

  const warehouses = useMemo(() => getWarehouses(), [])
  const categories = useMemo(() => getCategories(), [])
  const products = useMemo(() => getProducts(), [])
  const allMovements = useMemo(() => getMovements(), [])
  const balances = useMemo(() => getStockBalances(), [])

  // Filters
  const [search, setSearch] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filtered List
  const filteredMovements = useMemo(() => {
    return allMovements.filter(m => {
      const matchSearch = m.reference_no.toLowerCase().includes(search.toLowerCase()) ||
                          (m.challan_no && m.challan_no.toLowerCase().includes(search.toLowerCase())) ||
                          (m.supplier_customer && m.supplier_customer.toLowerCase().includes(search.toLowerCase())) ||
                          (m.product?.name && m.product.name.toLowerCase().includes(search.toLowerCase())) ||
                          (m.product?.sku && m.product.sku.toLowerCase().includes(search.toLowerCase()))
      const matchWh = warehouseFilter === 'all' || m.warehouse_id === warehouseFilter
      const matchCat = categoryFilter === 'all' || m.product?.category_id === categoryFilter
      const matchProd = productFilter === 'all' || m.product_id === productFilter
      const matchType = typeFilter === 'all' || m.movement_type === typeFilter
      const matchStatus = statusFilter === 'all' || m.status === statusFilter

      return matchSearch && matchWh && matchCat && matchProd && matchType && matchStatus
    })
  }, [allMovements, search, warehouseFilter, categoryFilter, productFilter, typeFilter, statusFilter])

  // Summary Metrics for the filtered period
  const totalInwardUnits = useMemo(() => {
    return filteredMovements
      .filter(m => m.movement_type === 'inward' || m.movement_type === 'return' || m.movement_type === 'transfer_in')
      .reduce((sum, m) => sum + m.quantity, 0)
  }, [filteredMovements])

  const totalOutwardUnits = useMemo(() => {
    return filteredMovements
      .filter(m => m.movement_type === 'outward' || m.movement_type === 'transfer_out')
      .reduce((sum, m) => sum + m.quantity, 0)
  }, [filteredMovements])

  const netLedgerChange = totalInwardUnits - totalOutwardUnits

  // Export CSV
  const handleExportCSV = () => {
    const exportData = filteredMovements.map(m => {
      const isInward = m.movement_type === 'inward' || m.movement_type === 'return' || m.movement_type === 'transfer_in'
      return {
        Reference_No: m.reference_no,
        Date: formatDate(m.created_at),
        Warehouse: m.warehouse?.name || '',
        SKU: m.product?.sku || '',
        Product_Name: m.product?.name || '',
        Category: m.product?.category?.name || '',
        Movement_Type: m.movement_type,
        Inward_Qty: isInward ? m.quantity : 0,
        Outward_Qty: !isInward ? m.quantity : 0,
        Unit: m.product?.unit || 'piece',
        Challan_Invoice: m.challan_no || '',
        Supplier_Customer: m.supplier_customer || '',
        Entered_By: m.creator_name || '',
        Status: m.status
      }
    })

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Stock_Movement_Ledger_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('success', 'CSV Exported', 'Stock ledger downloaded as CSV.')
  }

  // Export Excel (.xlsx) using SheetJS
  const handleExportExcel = () => {
    const exportData = filteredMovements.map(m => {
      const isInward = m.movement_type === 'inward' || m.movement_type === 'return' || m.movement_type === 'transfer_in'
      return {
        'Ref No': m.reference_no,
        'Date': formatDate(m.created_at),
        'Warehouse': m.warehouse?.name || '',
        'SKU': m.product?.sku || '',
        'Product': m.product?.name || '',
        'Category': m.product?.category?.name || '',
        'Type': m.movement_type,
        'Inward': isInward ? m.quantity : 0,
        'Outward': !isInward ? m.quantity : 0,
        'Unit': m.product?.unit || 'piece',
        'Party / Ref': m.supplier_customer || m.challan_no || '',
        'Created By': m.creator_name || '',
        'Status': m.status
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Ledger')
    XLSX.writeFile(workbook, `StockFlow_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast('success', 'Excel Exported', 'Stock ledger downloaded as XLSX.')
  }

  return (
    <AdminLayout title="Stock Movement Ledger Register">
      <div className="space-y-4">
        {/* Ledger Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4 border border-brand-border bg-white rounded-2xl shadow-card">
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Total Inward Received</span>
              <ArrowDownLeft className="w-4 h-4 text-brand-success" />
            </div>
            <p className="text-2xl font-bold text-brand-success">+{formatNumber(totalInwardUnits)}</p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Purchases & returns posted</p>
          </div>

          <div className="card p-4 border border-brand-border bg-white rounded-2xl shadow-card">
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Total Outward Dispatched</span>
              <ArrowUpRight className="w-4 h-4 text-brand-error" />
            </div>
            <p className="text-2xl font-bold text-brand-error">−{formatNumber(totalOutwardUnits)}</p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Sales & transfers issued</p>
          </div>

          <div className="card p-4 border border-brand-border bg-white rounded-2xl shadow-card">
            <div className="flex items-center justify-between text-brand-textSecondary mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider">Net Movement Delta</span>
              <BookOpen className="w-4 h-4 text-teal-DEFAULT" />
            </div>
            <p className={`text-2xl font-bold ${netLedgerChange >= 0 ? 'text-teal-DEFAULT' : 'text-brand-error'}`}>
              {netLedgerChange >= 0 ? `+${formatNumber(netLedgerChange)}` : formatNumber(netLedgerChange)}
            </p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5">Net inventory variance</p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-brand-textSecondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ref no, SKU, product, party..."
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
                <Download className="w-4 h-4 text-teal-DEFAULT" /> CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" /> Excel (.XLSX)
              </button>
            </div>
          </div>

          {/* Detailed Dropdown Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-brand-border/60">
            <div>
              <label className="label">Godown Location</label>
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
              <label className="label">Category</label>
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
              <label className="label">Movement Type</label>
              <select
                className="input-field text-xs font-medium capitalize"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="inward">Inward</option>
                <option value="outward">Outward</option>
                <option value="transfer_in">Transfer In</option>
                <option value="transfer_out">Transfer Out</option>
                <option value="return">Return</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="label">Posting Status</label>
              <select
                className="input-field text-xs font-medium capitalize"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="posted">Posted to Ledger</option>
                <option value="approved">Approved</option>
                <option value="submitted">Submitted (Pending)</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card overflow-hidden p-0">
          <div className="p-3.5 border-b border-brand-border flex items-center justify-between text-xs font-bold text-navy-DEFAULT">
            <span>Filtered Transactions: {filteredMovements.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-tableHeader text-brand-textSecondary font-semibold uppercase text-[10px] tracking-wider border-b border-brand-border">
                <tr>
                  <th className="py-3 px-4">Ref / Date</th>
                  <th className="py-3 px-4">Godown</th>
                  <th className="py-3 px-4">Product SKU & Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Inward</th>
                  <th className="py-3 px-4 text-right">Outward</th>
                  <th className="py-3 px-4">Party / Challan</th>
                  <th className="py-3 px-4">Entered By</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-brand-textSecondary">
                      No stock movements found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(m => {
                    const isInward = m.movement_type === 'inward' || m.movement_type === 'return' || m.movement_type === 'transfer_in'
                    const unitLabel = getUnitLabel(m.product?.unit)

                    return (
                      <tr key={m.id} className="hover:bg-brand-bg/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-bold text-navy-DEFAULT block">{m.reference_no}</span>
                          <span className="text-[10px] text-brand-textSecondary">{formatDate(m.created_at)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-navy-DEFAULT">{m.warehouse?.code}</span>
                          <span className="block text-[10px] text-brand-textSecondary truncate max-w-[100px]">{m.warehouse?.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-navy-DEFAULT">{m.product?.sku}</span>
                          <span className="block text-[11px] text-brand-textSecondary truncate max-w-[160px]">{m.product?.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-semibold uppercase text-[10px] ${isInward ? 'text-brand-success' : 'text-brand-error'}`}>
                            {isInward ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {m.movement_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-brand-success">
                          {isInward ? `+${formatNumber(m.quantity)} ${unitLabel}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-brand-error">
                          {!isInward ? `−${formatNumber(m.quantity)} ${unitLabel}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-brand-textSecondary truncate max-w-[130px]">
                          {m.supplier_customer || m.challan_no || '-'}
                        </td>
                        <td className="py-3 px-4 text-brand-textPrimary font-medium">
                          {m.creator_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(m.status)}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
