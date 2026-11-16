import React, { useState, useMemo } from 'react'
import {
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2,
  FileText, ArrowRight, RefreshCw, Database, Trash2
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import {
  getProducts, getWarehouses, getCategories, saveProduct,
  updateStockBalance, createMovement
} from '../../lib/dataService'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import { formatNumber, generateRef } from '../../lib/utils'
import type { Product, ProductUnit } from '../../types'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

type ImportType = 'products' | 'opening_stock' | 'rates'

interface ImportError {
  row: number
  sku: string
  reason: string
}

export default function AdminImportExport() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const warehouses = useMemo(() => getWarehouses(), [])
  const categories = useMemo(() => getCategories(), [])
  const existingProducts = useMemo(() => getProducts(), [])

  const [importType, setImportType] = useState<ImportType>('products')
  const [targetWarehouseId, setTargetWarehouseId] = useState(warehouses[1]?.id || '')

  // File Upload State
  const [fileData, setFileData] = useState<any[]>([])
  const [fileName, setFileName] = useState('')
  const [importErrors, setImportErrors] = useState<ImportError[]>([])
  const [validatedRows, setValidatedRows] = useState<any[]>([])
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; failed: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Download Sample Template
  const handleDownloadSample = () => {
    let headers: string[] = []
    let templateName = ''

    if (importType === 'products') {
      templateName = 'Products_Import_Template.xlsx'
      headers = ['sku', 'name', 'category', 'grade', 'diameter_mm', 'pressure_rating_kg', 'coil_length_m', 'unit', 'rate', 'gst_percent', 'min_stock_threshold', 'status']
    } else if (importType === 'opening_stock') {
      templateName = 'Opening_Stock_Import_Template.xlsx'
      headers = ['sku', 'quantity', 'notes']
    } else {
      templateName = 'Price_Rates_Import_Template.xlsx'
      headers = ['sku', 'rate', 'gst_percent']
    }

    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, templateName)
    toast('info', 'Template Downloaded', `Blank template "${templateName}" saved.`)
  }

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportResult(null)
    setImportErrors([])
    setValidatedRows([])

    const reader = new FileReader()

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processRawData(results.data as any[])
        },
        error: (err) => {
          toast('error', 'CSV Parse Error', err.message)
        }
      })
    } else {
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const wsname = wb.SheetNames[0]
          const ws = wb.Sheets[wsname]
          const data = XLSX.utils.sheet_to_json(ws)
          processRawData(data)
        } catch (err: any) {
          toast('error', 'Excel Parse Error', err.message)
        }
      }
      reader.readAsBinaryString(file)
    }
  }

  // Validate parsed data
  const processRawData = (rows: any[]) => {
    setFileData(rows)
    const errors: ImportError[] = []
    const valid: any[] = []

    rows.forEach((row, idx) => {
      const rowNum = idx + 2 // 1-indexed header is row 1
      const rawSku = (row.sku || row.SKU || row['Product SKU'] || '').toString().trim()

      if (!rawSku) {
        errors.push({ row: rowNum, sku: '-', reason: 'Missing required SKU / Product Code' })
        return
      }

      if (importType === 'products') {
        const rawName = (row.name || row.Name || row['Product Name'] || '').toString().trim()
        const rawRate = Number(row.rate || row.Rate || row['Standard Rate'] || 0)
        const catName = (row.category || row.Category || '').toString().trim()

        if (!rawName) {
          errors.push({ row: rowNum, sku: rawSku, reason: 'Product Name is empty' })
          return
        }
        if (!rawRate || isNaN(rawRate) || rawRate < 0) {
          errors.push({ row: rowNum, sku: rawSku, reason: 'Invalid or missing product rate' })
          return
        }

        // Match category
        const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase() || c.code.toLowerCase() === catName.toLowerCase()) || categories[0]

        valid.push({
          sku: rawSku,
          name: rawName,
          category_id: cat.id,
          unit: (row.unit || 'piece').toLowerCase(),
          rate: rawRate,
          gst_percent: Number(row.gst_percent || 18),
          grade: row.grade || null,
          diameter_mm: row.diameter_mm ? Number(row.diameter_mm) : null,
          pressure_rating_kg: row.pressure_rating_kg ? Number(row.pressure_rating_kg) : null,
          min_stock_threshold: row.min_stock_threshold ? Number(row.min_stock_threshold) : null,
          is_active: true
        })
      } else if (importType === 'opening_stock') {
        const qty = Number(row.quantity || row.Quantity || row.qty || 0)
        if (isNaN(qty) || qty < 0) {
          errors.push({ row: rowNum, sku: rawSku, reason: 'Quantity must be a non-negative number' })
          return
        }
        const existing = existingProducts.find(p => p.sku.toLowerCase() === rawSku.toLowerCase())
        if (!existing) {
          errors.push({ row: rowNum, sku: rawSku, reason: `SKU "${rawSku}" does not exist in product master` })
          return
        }
        valid.push({
          productId: existing.id,
          sku: rawSku,
          productName: existing.name,
          quantity: qty,
          notes: row.notes || 'Opening stock import'
        })
      } else if (importType === 'rates') {
        const rate = Number(row.rate || row.Rate || 0)
        if (!rate || isNaN(rate) || rate <= 0) {
          errors.push({ row: rowNum, sku: rawSku, reason: 'Rate must be a positive number' })
          return
        }
        const existing = existingProducts.find(p => p.sku.toLowerCase() === rawSku.toLowerCase())
        if (!existing) {
          errors.push({ row: rowNum, sku: rawSku, reason: `SKU "${rawSku}" does not exist in master catalog` })
          return
        }
        valid.push({
          productId: existing.id,
          sku: rawSku,
          rate,
          gst_percent: Number(row.gst_percent || existing.gst_percent)
        })
      }
    })

    setImportErrors(errors)
    setValidatedRows(valid)
  }

  // Execute Import
  const handleExecuteImport = () => {
    if (!profile) return
    setIsProcessing(true)

    let inserted = 0
    let updated = 0

    try {
      if (importType === 'products') {
        for (const item of validatedRows) {
          const exists = existingProducts.find(p => p.sku.toLowerCase() === item.sku.toLowerCase())
          saveProduct({
            id: exists?.id || '',
            sku: item.sku,
            name: item.name,
            category_id: item.category_id,
            unit: item.unit as ProductUnit,
            rate: item.rate,
            gst_percent: item.gst_percent,
            grade: item.grade,
            diameter_mm: item.diameter_mm,
            pressure_rating_kg: item.pressure_rating_kg,
            min_stock_threshold: item.min_stock_threshold,
            is_active: true,
            created_at: exists?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          if (exists) updated++
          else inserted++
        }
      } else if (importType === 'opening_stock') {
        for (const item of validatedRows) {
          updateStockBalance(item.productId, targetWarehouseId, item.quantity)
          createMovement({
            reference_no: generateRef('OPN'),
            movement_type: 'opening',
            product_id: item.productId,
            warehouse_id: targetWarehouseId,
            quantity: item.quantity,
            notes: `Batch opening stock import for ${warehouses.find(w => w.id === targetWarehouseId)?.name}`,
            created_by: profile.id,
            creator_name: profile.full_name,
            status: 'posted',
            posted_at: new Date().toISOString()
          }, profile)
          inserted++
        }
      } else if (importType === 'rates') {
        for (const item of validatedRows) {
          const existing = existingProducts.find(p => p.id === item.productId)
          if (existing) {
            saveProduct({
              ...existing,
              rate: item.rate,
              gst_percent: item.gst_percent,
              updated_at: new Date().toISOString()
            })
            updated++
          }
        }
      }

      setImportResult({ inserted, updated, failed: importErrors.length })
      toast('success', 'Import Successful', `Processed ${inserted + updated} rows (${inserted} inserted, ${updated} updated).`)
    } catch (err: any) {
      toast('error', 'Import Execution Failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Download Error Report
  const handleDownloadErrors = () => {
    const csv = Papa.unparse(importErrors)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Import_Errors_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <AdminLayout title="Excel & CSV Data Import / Export Center">
      <div className="space-y-6">
        {/* Import Type Selector Card */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-brand-border gap-2">
            <div>
              <h3 className="font-bold text-sm text-navy-DEFAULT">Batch Data Import Wizard</h3>
              <p className="text-xs text-brand-textSecondary">
                Import product master catalogs, opening balances, or bulk price updates from Excel (.xlsx) or CSV.
              </p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-teal-DEFAULT" /> Download Sample Template
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => { setImportType('products'); setFileData([]); setImportResult(null) }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                importType === 'products'
                  ? 'border-teal-DEFAULT bg-teal-50/50 shadow-sm'
                  : 'border-brand-border hover:bg-brand-bg'
              }`}
            >
              <span className="font-bold text-xs uppercase block text-navy-DEFAULT">1. Product Master</span>
              <span className="text-[11px] text-brand-textSecondary mt-0.5 block">
                SKUs, specs, units, rates & GST %
              </span>
            </button>

            <button
              onClick={() => { setImportType('opening_stock'); setFileData([]); setImportResult(null) }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                importType === 'opening_stock'
                  ? 'border-teal-DEFAULT bg-teal-50/50 shadow-sm'
                  : 'border-brand-border hover:bg-brand-bg'
              }`}
            >
              <span className="font-bold text-xs uppercase block text-navy-DEFAULT">2. Opening Stock Balances</span>
              <span className="text-[11px] text-brand-textSecondary mt-0.5 block">
                Initialize location inventory
              </span>
            </button>

            <button
              onClick={() => { setImportType('rates'); setFileData([]); setImportResult(null) }}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                importType === 'rates'
                  ? 'border-teal-DEFAULT bg-teal-50/50 shadow-sm'
                  : 'border-brand-border hover:bg-brand-bg'
              }`}
            >
              <span className="font-bold text-xs uppercase block text-navy-DEFAULT">3. Product Rates & GST</span>
              <span className="text-[11px] text-brand-textSecondary mt-0.5 block">
                Bulk price list rate revisions
              </span>
            </button>
          </div>

          {/* Location selector if importing opening stock */}
          {importType === 'opening_stock' && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <label className="label">Destination Godown Yard *</label>
              <select
                className="input-field text-xs font-semibold max-w-sm mt-1"
                value={targetWarehouseId}
                onChange={e => setTargetWarehouseId(e.target.value)}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
              <p className="text-[11px] text-brand-textSecondary mt-1">
                Opening stock transactions will be posted atomically to this godown's ledger.
              </p>
            </div>
          )}

          {/* File Upload Drop Zone */}
          <div className="border-2 border-dashed border-brand-border rounded-2xl p-6 text-center hover:border-teal-DEFAULT transition-colors bg-brand-bg/40">
            <Upload className="w-8 h-8 text-teal-DEFAULT mx-auto mb-2" />
            <p className="text-xs font-bold text-navy-DEFAULT">
              Choose an Excel (.xlsx) or CSV (.csv) file to import
            </p>
            <p className="text-[11px] text-brand-textSecondary mt-0.5 mb-3">
              Standard column headers: sku, name, rate, category, unit, quantity
            </p>
            <label className="btn-primary py-2 px-4 text-xs font-bold cursor-pointer inline-flex items-center gap-2 shadow-sm">
              <span>Select File from Computer</span>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            {fileName && (
              <p className="text-xs text-teal-DEFAULT font-semibold mt-2">
                Loaded file: <strong>{fileName}</strong> ({fileData.length} rows read)
              </p>
            )}
          </div>
        </div>

        {/* Validation & Preview Summary */}
        {fileData.length > 0 && (
          <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <div>
                <h3 className="font-bold text-sm text-navy-DEFAULT">Validation Summary</h3>
                <p className="text-xs text-brand-textSecondary">
                  {validatedRows.length} valid rows ready to import • {importErrors.length} errors detected
                </p>
              </div>

              {importErrors.length > 0 && (
                <button
                  onClick={handleDownloadErrors}
                  className="btn-secondary py-1 px-2.5 text-xs text-brand-error border-red-200 hover:bg-red-50 flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" /> Download Error Report
                </button>
              )}
            </div>

            {/* Error alerts if any */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-brand-error space-y-1 max-h-36 overflow-y-auto">
                <span className="font-bold block">Invalid Rows (Will be skipped):</span>
                {importErrors.slice(0, 5).map((err, i) => (
                  <p key={i}>
                    • Row {err.row} (SKU: {err.sku}): {err.reason}
                  </p>
                ))}
                {importErrors.length > 5 && (
                  <p className="font-semibold pt-1">...and {importErrors.length - 5} more errors.</p>
                )}
              </div>
            )}

            {/* Preview Table */}
            <div className="bg-brand-bg rounded-xl border border-brand-border/80 overflow-hidden">
              <div className="p-2.5 border-b border-brand-border font-bold text-xs text-navy-DEFAULT">
                Valid Preview (Showing first 5 rows):
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-brand-tableHeader text-[10px] text-brand-textSecondary uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      {importType === 'products' && <th className="py-2 px-3">Name</th>}
                      {importType === 'products' && <th className="py-2 px-3">Unit</th>}
                      {importType === 'products' && <th className="py-2 px-3 text-right">Rate</th>}
                      {importType === 'opening_stock' && <th className="py-2 px-3">Product Name</th>}
                      {importType === 'opening_stock' && <th className="py-2 px-3 text-right">Quantity</th>}
                      {importType === 'rates' && <th className="py-2 px-3 text-right">New Rate</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/60">
                    {validatedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-white/60">
                        <td className="py-2 px-3 font-bold text-navy-DEFAULT">{row.sku}</td>
                        {importType === 'products' && <td className="py-2 px-3">{row.name}</td>}
                        {importType === 'products' && <td className="py-2 px-3 capitalize">{row.unit}</td>}
                        {importType === 'products' && <td className="py-2 px-3 text-right font-semibold">₹{row.rate}</td>}
                        {importType === 'opening_stock' && <td className="py-2 px-3">{row.productName}</td>}
                        {importType === 'opening_stock' && <td className="py-2 px-3 text-right font-bold text-brand-success">{formatNumber(row.quantity)}</td>}
                        {importType === 'rates' && <td className="py-2 px-3 text-right font-bold text-navy-DEFAULT">₹{row.rate}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confirm Execution Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteImport}
                disabled={validatedRows.length === 0 || isProcessing}
                className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Import {validatedRows.length} Records</span>
              </button>
            </div>
          </div>
        )}

        {/* Import Results Banner */}
        {importResult && (
          <div className="card border border-green-200 bg-green-50/60 rounded-2xl shadow-card p-4 text-xs space-y-1">
            <div className="flex items-center gap-2 text-brand-success font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Import Completed Successfully!</span>
            </div>
            <p className="text-brand-textPrimary">
              <strong>{importResult.inserted}</strong> records inserted • <strong>{importResult.updated}</strong> records updated • <strong>{importResult.failed}</strong> records failed/skipped.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
