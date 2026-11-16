import React, { useState, useMemo } from 'react'
import {
  FileSpreadsheet, Printer, Download, Package, ArrowLeft, RefreshCw,
  Clock, AlertTriangle, Layers, Percent, Info
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../../components/shared/AdminLayout'
import EmptyState from '../../components/ui/EmptyState'
import { getCurrentStockReportData } from '../../lib/dataService'
import { formatCurrency, formatNumber, getUnitLabel, formatDate } from '../../lib/utils'
import { useToast } from '../../store/ToastContext'
import * as XLSX from 'xlsx'

export default function AdminStockReport() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [activeCategoryId, setActiveCategoryId] = useState('all')
  const [dataVersion, setDataVersion] = useState(0)

  // Report data is computed from the current catalog, price rules, and balances.
  const reportData = useMemo(() => {
    return getCurrentStockReportData()
  }, [dataVersion])

  const handleRefresh = () => {
    setDataVersion(v => v + 1)
    toast('info', 'Report Refreshed', 'Report recalculated from available inventory records.')
  }

  // Print function
  const handlePrint = () => {
    window.print()
  }

  // Export to multi-sheet Excel workbook
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: Stock Summary
      const summaryRows: (string | number)[][] = [
        ['StockFlow Pro – Stock Valuation Summary'],
        ['Report Date:', reportData.report_date],
        ['Category discounts and GST are taken from configured product and pricing records.'],
        [''],
        ['Sr. No.', 'Product Category', 'Total Quantity', 'Unit', 'Discount', 'Value Before GST (₹)'],
      ]

      reportData.categories.forEach((cat, idx) => {
        summaryRows.push([
          idx + 1,
          cat.category_name,
          cat.total_quantity,
          cat.unit_label,
          `${cat.discount_percent}%`,
          cat.subtotal_before_gst
        ])
      })

      summaryRows.push([''])
      summaryRows.push(['', 'Subtotal Before GST (Priced Stock)', '', '', '', reportData.subtotal_before_gst])
      summaryRows.push(['', 'GST Amount (18%)', '', '', '', reportData.gst_amount])
      summaryRows.push(['', 'Grand Total Including 18% GST', '', '', '', reportData.grand_total])

      if (reportData.total_pending_items_count > 0) {
        summaryRows.push([''])
        summaryRows.push(['Note:', `${reportData.total_pending_items_count} unpriced products excluded from total valuation.`])
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
      wsSummary['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 22 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Stock Summary')

      reportData.categories.forEach(cat => {
        const sheetRows: (string | number)[][] = [
          [`StockFlow Pro – ${cat.category_name}`],
          [`Weighted effective discount: ${cat.discount_percent}% | Item values include 18% GST in category total`],
          [''],
          ['Sr. No.', 'Item Name', 'Current Total Stock Quantity', 'Discount', 'Rate per Item (₹)', 'Amount After Discount (₹)']
        ]

        cat.lines.forEach(line => {
          sheetRows.push([
            line.sr_no,
            line.item_name,
            line.quantity,
            `${line.discount_percent}%`,
            line.is_pending ? 'Pending' : line.rate,
            line.is_pending ? 'Pending' : line.amount_after_discount
          ])
        })

        sheetRows.push([''])
        sheetRows.push(['', 'Category Total Before GST', cat.total_quantity, '', '', cat.subtotal_before_gst])
        sheetRows.push(['', 'GST Amount (18%)', '', '', '', cat.gst_amount])
        sheetRows.push(['', 'Category Total Incl. 18% GST', '', '', '', cat.total_incl_gst])

        if (cat.pending_count > 0) {
          sheetRows.push([''])
          sheetRows.push(['Note:', `${cat.pending_count} item(s) marked pending and excluded from valuation totals.`])
        }

        const ws = XLSX.utils.aoa_to_sheet(sheetRows)
        ws['!cols'] = [{ wch: 8 }, { wch: 45 }, { wch: 26 }, { wch: 12 }, { wch: 18 }, { wch: 24 }]
        XLSX.utils.book_append_sheet(wb, ws, cat.code.slice(0, 31))
      })

      // Download file
      const fileName = `StockFlow_Current_Stock_Report_${reportData.report_date}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast('success', 'Excel Export Downloaded', `Generated multi-sheet workbook: ${fileName}`)
    } catch (err: any) {
      toast('error', 'Export Failed', err.message || 'Failed to generate Excel workbook.')
    }
  }

  const selectedCategories = useMemo(() => {
    if (activeCategoryId === 'all') return reportData.categories
    return reportData.categories.filter(category => category.category_id === activeCategoryId)
  }, [reportData, activeCategoryId])

  return (
    <AdminLayout title="Current Stock Report">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, .no-print, button, input {
            display: none !important;
          }
          .printable-report {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .page-break {
            page-break-before: always;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
          }
          .print-summary-box {
            border: 2px solid #0f172a !important;
            background-color: #f8fafc !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="printable-report space-y-5">
        {/* Top Control Bar (Screen only) */}
        <div className="no-print card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#0D827D] bg-[#E7F3F1] px-2.5 py-0.5 rounded-lg border border-[#0D827D]/30">
                Current Stock Valuation
              </span>
              <span className="text-xs text-[#72869A]">• Current inventory records</span>
            </div>
            <h1 className="text-lg font-bold text-[#102C42] mt-1">Official Current Stock & Valuation Report</h1>
            <p className="text-xs text-[#72869A]">
              Report Date: <strong>{formatDate(reportData.report_date, 'dd MMMM yyyy')}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5"
              title="Refresh stock balances from database"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={handlePrint}
              className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 border-[#0D827D] text-[#0D827D] hover:bg-[#E7F3F1]"
            >
              <Printer className="w-4 h-4" /> Print Stock Report
            </button>
            <button
              onClick={handleExportExcel}
              className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-4 h-4" /> Export to Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Printable Header (Visible on print & screen) */}
        <div className="p-5 bg-white border border-[#DCE5EB] rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#102C42] text-white flex items-center justify-center font-bold">
                <Package className="w-5 h-5 text-[#0D827D]" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-[#102C42]">STOCKFLOW PRO — WHOLESALE INVENTORY</h2>
                <p className="text-xs text-[#72869A]">Pipes, fittings, and water storage inventory</p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs">
            <p className="text-[#72869A]">Report As On: <strong className="text-[#102C42]">{formatDate(reportData.report_date, 'dd-MMM-yyyy')}</strong></p>
            <p className="text-[#72869A]">Applicable GST Rate: <strong className="text-[#102C42]">18.0% (Calculated at Bottom)</strong></p>
            <p className="text-[11px] text-[#72869A]">Columns: Sr. No., Item Name, Stock Qty, Discount %, Rate, Amount After Discount</p>
          </div>
        </div>

        {/* Category Navigation Tabs (no-print) */}
        <div className="no-print flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategoryId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              activeCategoryId === 'all'
                ? 'bg-[#102C42] text-white shadow-sm'
                : 'bg-white text-[#72869A] border border-[#DCE5EB] hover:bg-[#F4F7FA]'
            }`}
          >
            All Categories ({reportData.categories.length})
          </button>
          {reportData.categories.map(category => (
            <button
              key={category.category_id}
              onClick={() => setActiveCategoryId(category.category_id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeCategoryId === category.category_id
                  ? 'bg-[#102C42] text-white shadow-sm'
                  : 'bg-white text-[#72869A] border border-[#DCE5EB] hover:bg-[#F4F7FA]'
              }`}
            >
              {category.category_name}
            </button>
          ))}
        </div>

        {/* Categories Sections */}
        <div className="space-y-6">
          {selectedCategories.length === 0 ? (
            <div className="card border border-[#DCE5EB] bg-white rounded-2xl shadow-sm">
              <EmptyState
                icon={<Package className="w-7 h-7" />}
                title="No stock report data"
                description="Products and stock balances will appear here after they are added."
              />
            </div>
          ) : selectedCategories.map((cat, catIdx) => (
            <div
              key={cat.category_id}
              className={`card p-0 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm overflow-hidden ${
                catIdx > 0 ? 'page-break' : ''
              }`}
            >
              {/* Category Header Banner */}
              <div className="p-4 bg-[#F4F7FA] border-b border-[#DCE5EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-[#102C42] border border-[#DCE5EB]">
                    {cat.code}
                  </span>
                  <h3 className="text-sm font-bold text-[#102C42]">{cat.category_name}</h3>
                  <span className="text-xs text-[#72869A]">({cat.lines.length} SKUs)</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-[#72869A]">
                    Weighted effective discount: <strong className="text-[#102C42]">{cat.discount_percent}%</strong>
                  </span>
                  <span className="text-[#DCE5EB]">|</span>
                  <span className="font-semibold text-[#72869A]">
                    Total Stock: <strong className="text-[#102C42]">{formatNumber(cat.total_quantity)} {cat.unit_label}</strong>
                  </span>
                </div>
              </div>

              {/* Table conforming STRICTLY to user requirement:
                  1. Sr. No.
                  2. Item Name
                  3. Current Total Stock Quantity
                  4. Discount
                  5. Rate per Item
                  6. Amount After Discount
                  NO GST column on individual product rows!
              */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-[#FAFBFD] text-[#72869A] font-bold text-[10px] uppercase border-b border-[#DCE5EB]">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Sr. No.</th>
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-3 text-right">Current Total Stock Quantity</th>
                      <th className="py-2.5 px-3 text-center">Discount</th>
                      <th className="py-2.5 px-4 text-right">Rate per Item</th>
                      <th className="py-2.5 px-4 text-right">Amount After Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE5EB]">
                    {cat.lines.length > 0 ? (
                      cat.lines.map((line) => (
                        <tr
                          key={line.product_id}
                          className={`hover:bg-slate-50 transition-colors ${
                            line.is_pending ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-[#72869A] font-medium">
                            {line.sr_no}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-[#102C42] block">{line.item_name}</span>
                            <span className="font-mono text-[10px] text-[#72869A]">{line.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#102C42]">
                            {formatNumber(line.quantity)} <span className="text-[10px] text-[#72869A] font-normal">{getUnitLabel(line.unit)}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center text-[10px] font-bold bg-[#F4F7FA] text-[#102C42] border border-[#DCE5EB] px-2 py-0.5 rounded-full">
                              {line.discount_percent}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {line.is_pending ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                Rate Pending
                              </span>
                            ) : (
                              <span className="font-bold text-[#102C42]">₹{line.rate.toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono">
                            {line.is_pending ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                Pending
                              </span>
                            ) : (
                              <span className="font-bold text-[#102C42]">₹{line.amount_after_discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#72869A]">
                          No stock entries recorded in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Category Subtotal Footer */}
                  <tfoot className="bg-[#F4F7FA] font-bold text-xs border-t-2 border-[#DCE5EB]">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-4 text-[#102C42]">
                        {cat.category_name} Subtotal (Before GST)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#102C42]">
                        {formatNumber(cat.total_quantity)} {cat.unit_label}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="py-2.5 px-4 text-right font-mono text-sm text-[#102C42]">
                        ₹{cat.subtotal_before_gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Final valuation summary */}
        <div className="print-summary-box card p-6 border-2 border-[#102C42] bg-white rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DCE5EB] gap-2">
            <div>
              <h2 className="text-base font-extrabold text-[#102C42] flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0D827D]" />
                <span>Consolidated Stock Valuation & Grand Total</span>
              </h2>
              <p className="text-xs text-[#72869A]">
                Summary of all category stocks after applicable trade discounts with 18% GST calculation.
              </p>
            </div>
            {reportData.total_pending_items_count > 0 && (
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl self-start sm:self-auto">
                ⚠️ {reportData.total_pending_items_count} Unpriced Items Excluded (Marked Pending)
              </span>
            )}
          </div>

          {/* Breakdown Table in Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Category Subtotals List */}
            <div className="space-y-2 text-xs">
              <p className="font-bold text-[#72869A] uppercase tracking-wider text-[10px]">
                Category-Wise Discounted Valuation:
              </p>
              <div className="space-y-1.5 divide-y divide-[#DCE5EB]/60">
                {reportData.categories.map(cat => (
                  <div key={cat.category_id} className="flex justify-between items-center pt-1.5">
                    <span className="font-semibold text-[#102C42]">
                      {cat.category_name} ({formatNumber(cat.total_quantity)} {cat.unit_label}, {cat.discount_percent}% off)
                    </span>
                    <span className="font-mono font-bold text-[#102C42]">
                      ₹{cat.subtotal_before_gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Grand Totals Callout */}
            <div className="bg-[#FAFBFD] p-4 rounded-xl border border-[#DCE5EB] space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-sm font-bold text-[#102C42]">
                <span>Subtotal (After Discounts, Before GST):</span>
                <span className="font-mono text-base font-extrabold text-[#102C42]">
                  ₹{reportData.subtotal_before_gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-[#72869A] font-semibold border-t border-[#DCE5EB] pt-2">
                <span>Add: Applicable GST @ 18.0%:</span>
                <span className="font-mono font-bold text-[#102C42]">
                  ₹{reportData.gst_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2.5 border-t-2 border-[#102C42] text-[#102C42]">
                <div>
                  <span className="text-sm font-black uppercase tracking-wider block">Grand Total (Incl. 18% GST):</span>
                  <span className="text-[10px] text-[#72869A]">Total wholesale inventory valuation</span>
                </div>
                <span className="font-mono text-xl sm:text-2xl font-black text-[#0D827D]">
                  ₹{reportData.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Valuation source note */}
          <div className="p-3 bg-[#E7F3F1] border border-[#0D827D]/30 rounded-xl flex items-center justify-between text-xs text-[#102C42]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#0D827D] shrink-0" />
              <span>
                Values are calculated from the current inventory records and pricing rules.
              </span>
            </div>
          </div>
        </div>

        {/* Printable Signature Block */}
        <div className="hidden print:flex justify-between items-end pt-12 text-xs text-[#102C42]">
          <div className="text-center w-48">
            <div className="border-t border-black pt-1 font-bold">Godown Supervisor</div>
            <p className="text-[10px] text-[#72869A]">Physical Stock Checked</p>
          </div>
          <div className="text-center w-48">
            <div className="border-t border-black pt-1 font-bold">Store In-Charge</div>
            <p className="text-[10px] text-[#72869A]">Stock Register Verified</p>
          </div>
          <div className="text-center w-48">
            <div className="border-t border-black pt-1 font-bold">Authorized Signatory</div>
            <p className="text-[10px] text-[#72869A]">For StockFlow Pro</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
