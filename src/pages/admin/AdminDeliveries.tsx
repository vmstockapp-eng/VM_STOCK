import React, { useState, useMemo } from 'react'
import {
  Truck, Search, Filter, Calendar, MapPin, Gauge, User,
  CheckCircle2, Clock, AlertCircle, Eye, ArrowUpRight,
  FileText, ArrowLeft, X, Edit3, ChevronRight, Check
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getDeliveries, updateDeliveryReturnKM, getWarehouses
} from '../../lib/dataService'
import type { OutwardDelivery, DeliveryStatus } from '../../types'
import { formatDate, formatNumber } from '../../lib/utils'

export default function AdminDeliveries() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [deliveries, setDeliveries] = useState<OutwardDelivery[]>(() => getDeliveries())
  const warehouses = useMemo(() => getWarehouses(), [])

  // Filters & Search
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeliveryStatus>('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')

  // Selected delivery for Detail Modal
  const [selectedDelivery, setSelectedDelivery] = useState<OutwardDelivery | null>(null)

  const reloadDeliveries = () => {
    setDeliveries(getDeliveries())
  }

  const filteredDeliveries = useMemo(() => {
    let list = deliveries

    if (statusFilter !== 'all') {
      list = list.filter(d => d.status === statusFilter)
    }
    if (warehouseFilter !== 'all') {
      list = list.filter(d => d.warehouse_id === warehouseFilter)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d =>
        d.delivery_ref.toLowerCase().includes(q) ||
        d.do_number.toLowerCase().includes(q) ||
        d.memo_number.toLowerCase().includes(q) ||
        d.customer_name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.vehicle_registration_number.toLowerCase().includes(q) ||
        d.driver_name.toLowerCase().includes(q)
      )
    }

    return list
  }, [deliveries, search, statusFilter, warehouseFilter])

  return (
    <AdminLayout title="Outward Deliveries & Vehicle Logs">
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#102C42]">Customer Deliveries & Logistics Register</h1>
            <p className="text-xs text-[#72869A]">
              Live register of customer pipe dispatches, vehicle registrations, driver trips, and odometer readings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-[#E7F3F1] text-[#0D827D] px-3 py-1 rounded-xl border border-[#0D827D]/30">
              {deliveries.filter(d => d.status === 'awaiting_return').length} Awaiting Return
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#72869A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by vehicle reg, D.O., customer, driver..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="input-field text-xs py-1.5 w-full sm:w-44 font-semibold"
            >
              <option value="all">All Delivery Statuses</option>
              <option value="awaiting_return">⏳ Awaiting Return ({deliveries.filter(d => d.status === 'awaiting_return').length})</option>
              <option value="completed">✓ Completed ({deliveries.filter(d => d.status === 'completed').length})</option>
              <option value="draft">Drafts</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="input-field text-xs py-1.5 w-full sm:w-40 font-semibold"
            >
              <option value="all">All Godowns</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="card p-0 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#E7F3F1] border-b border-[#DCE5EB] text-[#72869A] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Ref & Date</th>
                  <th className="py-3 px-4">D.O. / Memo</th>
                  <th className="py-3 px-4">Customer & City</th>
                  <th className="py-3 px-4">Vehicle Reg</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4 text-center">Out KM</th>
                  <th className="py-3 px-4 text-center">In KM</th>
                  <th className="py-3 px-4 text-center">Distance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EB]">
                {filteredDeliveries.length > 0 ? (
                  filteredDeliveries.map(del => {
                    const isPending = del.status === 'awaiting_return'

                    return (
                      <tr key={del.id} className="hover:bg-[#F4F7FA]/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-[#102C42]">{del.delivery_ref}</p>
                          <p className="text-[11px] text-[#72869A]">{formatDate(del.date, 'dd MMM yyyy')}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#102C42]">{del.do_number}</p>
                          <p className="text-[11px] text-[#72869A]">{del.memo_number}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#102C42]">{del.customer_name}</p>
                          <p className="text-[11px] text-[#72869A]">{del.city}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-mono font-extrabold text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                            {del.vehicle_registration_number}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-[#102C42]">
                          {del.driver_name}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-[#102C42]">
                          {formatNumber(del.vehicle_out_km)}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono">
                          {del.vehicle_in_km ? (
                            <span className="font-bold text-[#102C42]">{formatNumber(del.vehicle_in_km)}</span>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Awaiting
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {del.distance_travelled !== null && del.distance_travelled !== undefined ? (
                            <span className="font-extrabold text-[#0D827D] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              {formatNumber(del.distance_travelled)} km
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {del.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-[#16845B] border border-green-200">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Awaiting Return
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                                title="Vehicle IN KM is recorded exclusively by Godown Staff upon return"
                              >
                                <Clock className="w-3 h-3" />
                                <span>Vehicle Out (Staff Logs IN KM)</span>
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedDelivery(del)}
                              className="p-1.5 text-[#102C42] hover:bg-slate-100 rounded-lg transition-colors"
                              title="View delivery details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[#72869A]">
                      No outward deliveries found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full Delivery Detail View Modal */}
        {selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                <div>
                  <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#0D827D]" />
                    <span>Outward Delivery Summary — {selectedDelivery.delivery_ref}</span>
                  </h2>
                  <p className="text-[11px] text-[#72869A]">{formatDate(selectedDelivery.date, 'EEEE, dd MMMM yyyy')}</p>
                </div>
                <button onClick={() => setSelectedDelivery(null)} className="p-1 text-[#72869A] hover:text-[#102C42]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
                {/* Document & Customer Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] text-xs">
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Customer</span>
                    <span className="font-bold text-[#102C42]">{selectedDelivery.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">City</span>
                    <span className="font-bold text-[#102C42]">{selectedDelivery.city}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">D.O. Number</span>
                    <span className="font-mono font-bold text-[#102C42]">{selectedDelivery.do_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#72869A] uppercase font-bold block">Memo No.</span>
                    <span className="font-mono font-bold text-[#102C42]">{selectedDelivery.memo_number}</span>
                  </div>
                </div>

                {/* Vehicle & Driver Card */}
                <div className="p-3.5 rounded-xl border border-[#DCE5EB] bg-white space-y-2 text-xs">
                  <h3 className="text-xs font-bold text-[#102C42] uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#0D827D]" /> Transport & Vehicle Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#72869A]">Vehicle Reg:</span>{' '}
                      <strong className="font-mono text-[#102C42]">{selectedDelivery.vehicle_registration_number}</strong>
                    </div>
                    <div>
                      <span className="text-[#72869A]">Driver Name:</span>{' '}
                      <strong className="text-[#102C42]">{selectedDelivery.driver_name}</strong>
                    </div>
                    {selectedDelivery.other_driver_phone && (
                      <div>
                        <span className="text-[#72869A]">Driver Phone:</span>{' '}
                        <strong className="text-[#102C42]">{selectedDelivery.other_driver_phone}</strong>
                      </div>
                    )}
                    {selectedDelivery.other_driver_address && (
                      <div>
                        <span className="text-[#72869A]">Driver Address:</span>{' '}
                        <strong className="text-[#102C42]">{selectedDelivery.other_driver_address}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Odometer Calculation Section */}
                <div className="p-3.5 rounded-xl border border-[#0D827D]/30 bg-[#E7F3F1]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#0D827D] uppercase tracking-wider flex items-center gap-1.5">
                      <Gauge className="w-4 h-4" /> Vehicle Odometer & Distance Log
                    </h3>
                    {selectedDelivery.status === 'awaiting_return' ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        Vehicle Out — Return KM Recorded by Godown Staff
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#16845B] bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                        Trip Completed
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2 bg-white rounded-lg text-center text-xs border border-[#DCE5EB]">
                    <div>
                      <p className="text-[10px] text-[#72869A] uppercase font-bold">Out KM (Dispatch)</p>
                      <p className="font-extrabold text-sm text-[#102C42]">{formatNumber(selectedDelivery.vehicle_out_km)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#72869A] uppercase font-bold">In KM (Return)</p>
                      <p className="font-extrabold text-sm text-[#102C42]">
                        {selectedDelivery.vehicle_in_km ? formatNumber(selectedDelivery.vehicle_in_km) : 'Awaiting Return'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#72869A] uppercase font-bold">Total Distance</p>
                      <p className="font-extrabold text-sm text-[#0D827D]">
                        {selectedDelivery.distance_travelled !== null && selectedDelivery.distance_travelled !== undefined
                          ? `${formatNumber(selectedDelivery.distance_travelled)} km`
                          : 'Pending'}
                      </p>
                    </div>
                  </div>

                  {selectedDelivery.return_notes && (
                    <p className="text-[11px] text-[#20384A] italic">
                      Return notes: "{selectedDelivery.return_notes}" (Updated by {selectedDelivery.return_updated_by || 'Admin'})
                    </p>
                  )}
                </div>

                {/* Dispatched Products List */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#102C42] uppercase tracking-wider">Dispatched Products</h3>
                  <div className="rounded-xl border border-[#DCE5EB] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#E7F3F1] text-[#72869A] uppercase text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3">Size / SKU</th>
                          <th className="py-2 px-3 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCE5EB]">
                        {selectedDelivery.items.filter(it => it.quantity > 0).map(item => (
                          <tr key={item.id}>
                            <td className="py-2 px-3 font-semibold text-[#102C42]">
                              {item.product?.name || `Product Item`}
                            </td>
                            <td className="py-2 px-3 text-[#72869A] font-mono">
                              {item.size_label ? `${item.size_label} mm` : item.product?.sku || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-extrabold text-[#102C42]">
                              {formatNumber(item.quantity)} {item.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fittings Text Details */}
                {selectedDelivery.fittings_details && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                    <h4 className="font-bold text-amber-900 uppercase text-[10px]">Fittings / Other Material Details</h4>
                    <p className="text-amber-950 whitespace-pre-wrap">{selectedDelivery.fittings_details}</p>
                  </div>
                )}

                {/* Destination & Notes */}
                {(selectedDelivery.delivery_address || selectedDelivery.delivery_notes) && (
                  <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] text-xs space-y-1">
                    {selectedDelivery.delivery_address && (
                      <p><strong className="text-[#102C42]">Address:</strong> {selectedDelivery.delivery_address}</p>
                    )}
                    {selectedDelivery.delivery_notes && (
                      <p><strong className="text-[#102C42]">Notes:</strong> {selectedDelivery.delivery_notes}</p>
                    )}
                  </div>
                )}

                <div className="pt-2 text-[10px] text-[#72869A] flex justify-between">
                  <span>Created by: {selectedDelivery.creator_name || 'Staff User'}</span>
                  <span>{formatDate(selectedDelivery.created_at, 'dd MMM yyyy, HH:mm')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
