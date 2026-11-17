import React, { useState, useMemo, useEffect } from 'react'
import {
  Truck, Plus, Search, Filter, CheckCircle2, XCircle, AlertTriangle,
  Edit, Eye, ArrowLeftRight, Calendar, Phone, ShieldCheck, History,
  X, Check, RotateCcw
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import {
  getVehicles, saveVehicle, toggleVehicleActive, getVehicleDeliveries, hydrateCatalogCacheFromSupabase
} from '../../lib/dataService'
import type { Vehicle, OutwardDelivery } from '../../types'
import { formatDate, formatNumber } from '../../lib/utils'

export default function AdminVehicles() {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)

  // Delivery History Modal
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)
  const [historyDeliveries, setHistoryDeliveries] = useState<OutwardDelivery[]>([])

  // Form Fields
  const [name, setName] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [vehicleType, setVehicleType] = useState('Truck')
  const [insurancePolicy, setInsurancePolicy] = useState('')
  const [insuranceExpiry, setInsuranceExpiry] = useState('')
  const [pucCert, setPucCert] = useState('')
  const [pucExpiry, setPucExpiry] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  const reloadVehicles = () => {
    setVehicles(getVehicles())
  }

  // Always load the shared database catalog on this screen; localStorage is
  // only a cache and must never be treated as the source of truth.
  useEffect(() => {
    let active = true
    hydrateCatalogCacheFromSupabase()
      .then(() => { if (active) reloadVehicles() })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to load vehicles from Supabase.'
        toast('error', 'Vehicle Catalog Load Failed', message)
      })
    return () => { active = false }
  }, [])

  const handleOpenAdd = () => {
    setEditingVehicle(null)
    setName('')
    setRegNumber('')
    setVehicleType('Truck')
    setInsurancePolicy('')
    setInsuranceExpiry('')
    setPucCert('')
    setPucExpiry('')
    setOwnerName('')
    setContactNumber('')
    setNotes('')
    setIsActive(true)
    setIsAddEditOpen(true)
  }

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v)
    setName(v.name)
    setRegNumber(v.registration_number)
    setVehicleType(v.vehicle_type)
    setInsurancePolicy(v.insurance_policy_no || '')
    setInsuranceExpiry(v.insurance_expiry_date || '')
    setPucCert(v.puc_certificate_no || '')
    setPucExpiry(v.puc_expiry_date || '')
    setOwnerName(v.owner_name || '')
    setContactNumber(v.contact_number || '')
    setNotes(v.notes || '')
    setIsActive(v.is_active)
    setIsAddEditOpen(true)
  }

  const handleOpenHistory = (v: Vehicle) => {
    setHistoryVehicle(v)
    const dels = getVehicleDeliveries(v.registration_number)
    setHistoryDeliveries(dels)
  }

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      const updated = await toggleVehicleActive(id)
      reloadVehicles()
      toast('info', 'Vehicle Status Changed', `${name} is now ${updated.is_active ? 'Active' : 'Inactive'}.`)
    } catch (err: any) {
      toast('error', 'Status Update Failed', err.message)
    }
  }

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('error', 'Missing Name', 'Vehicle Name is required.')
      return
    }
    if (!regNumber.trim()) {
      toast('error', 'Missing Registration', 'Registration Number is required.')
      return
    }

    try {
      await saveVehicle({
        id: editingVehicle?.id,
        name: name.trim(),
        registration_number: regNumber.trim().toUpperCase(),
        vehicle_type: vehicleType.trim(),
        insurance_policy_no: insurancePolicy.trim() || null,
        insurance_expiry_date: insuranceExpiry || null,
        puc_certificate_no: pucCert.trim() || null,
        puc_expiry_date: pucExpiry || null,
        owner_name: ownerName.trim() || null,
        contact_number: contactNumber.trim() || null,
        notes: notes.trim() || null,
        is_active: isActive
      })

      reloadVehicles()
      setIsAddEditOpen(false)
      toast('success', 'Vehicle Saved', `Vehicle ${regNumber.toUpperCase()} has been saved successfully.`)
    } catch (err: any) {
      toast('error', 'Save Failed', err.message)
    }
  }

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    let list = vehicles

    if (statusFilter === 'active') list = list.filter(v => v.is_active)
    if (statusFilter === 'inactive') list = list.filter(v => !v.is_active)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.registration_number.toLowerCase().includes(q) ||
        v.vehicle_type.toLowerCase().includes(q) ||
        (v.owner_name && v.owner_name.toLowerCase().includes(q))
      )
    }

    return list
  }, [vehicles, search, statusFilter])

  // Expiry Checker helper
  const checkExpiryStatus = (dateStr?: string | null) => {
    if (!dateStr) return { status: 'none', label: 'Not Set', color: 'text-slate-400' }
    const target = new Date(dateStr).getTime()
    const now = new Date().getTime()
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { status: 'expired', label: `Expired (${formatDate(dateStr, 'dd MMM yyyy')})`, color: 'text-red-600 font-bold' }
    } else if (diffDays <= 30) {
      return { status: 'expiring', label: `Expires in ${diffDays}d (${formatDate(dateStr, 'dd MMM')})`, color: 'text-amber-600 font-bold' }
    }
    return { status: 'valid', label: formatDate(dateStr, 'dd MMM yyyy'), color: 'text-green-700 font-semibold' }
  }

  return (
    <AdminLayout title="Vehicle Management">
      <div className="space-y-5">
        {/* Top Header Card */}
        <div className="card p-5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[#102C42]">Commercial Transport Fleet</h1>
            <p className="text-xs text-[#72869A]">
              Manage trucks, tempos & delivery vehicles. Track insurance, PUC & dispatch kilometre readings.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#72869A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by reg number, vehicle name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-[#72869A] font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="input-field text-xs py-1.5 w-full sm:w-36 font-semibold"
            >
              <option value="all">All Fleet ({vehicles.length})</option>
              <option value="active">Active ({vehicles.filter(v => v.is_active).length})</option>
              <option value="inactive">Inactive ({vehicles.filter(v => !v.is_active).length})</option>
            </select>
          </div>
        </div>

        {/* Vehicles Table */}
        <div className="card p-0 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-[#E7F3F1] border-b border-[#DCE5EB] text-[#72869A] uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3 px-4">Vehicle Details</th>
                  <th className="py-3 px-4">Registration No.</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Insurance Expiry</th>
                  <th className="py-3 px-4">PUC Expiry</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5EB]">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map(veh => {
                    const ins = checkExpiryStatus(veh.insurance_expiry_date)
                    const puc = checkExpiryStatus(veh.puc_expiry_date)

                    return (
                      <tr key={veh.id} className="hover:bg-[#F4F7FA]/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0D827D] border border-teal-200 flex items-center justify-center shrink-0">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-[#102C42]">{veh.name}</p>
                              {veh.owner_name && (
                                <p className="text-[11px] text-[#72869A]">Owner: {veh.owner_name}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-extrabold text-[#102C42]">
                          {veh.registration_number}
                        </td>

                        <td className="py-3.5 px-4 text-[#72869A] font-medium">
                          {veh.vehicle_type}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={ins.color}>{ins.label}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={puc.color}>{puc.label}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          {veh.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-[#16845B] border border-green-200">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#72869A] border border-slate-300">
                              <XCircle className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenHistory(veh)}
                              title="View delivery odometer history"
                              className="p-1.5 text-[#0D827D] hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(veh)}
                              title="Edit vehicle details"
                              className="p-1.5 text-[#102C42] hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(veh.id, veh.name)}
                              title={veh.is_active ? 'Deactivate vehicle' : 'Activate vehicle'}
                              className={`p-1.5 rounded-lg transition-colors ${veh.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                            >
                              {veh.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#72869A]">
                      No vehicles found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add / Edit Vehicle Modal */}
        {isAddEditOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#0D827D]" />
                  <span>{editingVehicle ? 'Edit Vehicle Details' : 'Add New Commercial Vehicle'}</span>
                </h2>
                <button
                  onClick={() => setIsAddEditOpen(false)}
                  className="p-1 text-[#72869A] hover:text-[#102C42]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Vehicle Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Tata 407 LPT Heavy"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label">Registration Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. MH-12-Q-4521"
                      value={regNumber}
                      onChange={e => setRegNumber(e.target.value)}
                      required
                      className="input-field font-mono uppercase font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Vehicle Type</label>
                    <select
                      value={vehicleType}
                      onChange={e => setVehicleType(e.target.value)}
                      className="input-field"
                    >
                      <option value="Truck (6-Wheeler)">Truck (6-Wheeler)</option>
                      <option value="Truck (4-Wheeler)">Truck (4-Wheeler)</option>
                      <option value="Pickup (Light Commercial)">Pickup (Light Commercial)</option>
                      <option value="Trailer (Heavy Pipe Hauler)">Trailer (Heavy Pipe Hauler)</option>
                      <option value="Three-Wheeler / Auto Tempo">Three-Wheeler / Auto Tempo</option>
                      <option value="Other Commercial">Other Commercial</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Vehicle Owner / Fleet</label>
                    <input
                      type="text"
                      placeholder="e.g. StockFlow Logistics Ltd"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Compliance: Insurance & PUC */}
                <div className="p-3 bg-[#F4F7FA] rounded-xl border border-[#DCE5EB] space-y-3">
                  <h3 className="text-xs font-bold text-[#102C42] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0D827D]" />
                    <span>Compliance & Documents</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Insurance Policy No.</label>
                      <input
                        type="text"
                        placeholder="e.g. POL-NIC-899120"
                        value={insurancePolicy}
                        onChange={e => setInsurancePolicy(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Insurance Expiry Date</label>
                      <input
                        type="date"
                        value={insuranceExpiry}
                        onChange={e => setInsuranceExpiry(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">PUC Certificate No.</label>
                      <input
                        type="text"
                        placeholder="e.g. PUC-MH12-2026-9921"
                        value={pucCert}
                        onChange={e => setPucCert(e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">PUC Expiry Date</label>
                      <input
                        type="date"
                        value={pucExpiry}
                        onChange={e => setPucExpiry(e.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Emergency Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98220 11223"
                      value={contactNumber}
                      onChange={e => setContactNumber(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="veh-active"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#0D827D] rounded border-[#DCE5EB] focus:ring-[#0D827D]"
                    />
                    <label htmlFor="veh-active" className="text-xs font-bold text-[#102C42]">
                      Active for outward deliveries
                    </label>
                  </div>
                </div>

                <div>
                  <label className="label">Vehicle Notes / Pipe Rack Specifications</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Fitted with 6m overhead pipe bars, max 4.5 tons payload"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="input-field text-xs resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE5EB]">
                  <button
                    type="button"
                    onClick={() => setIsAddEditOpen(false)}
                    className="btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs"
                  >
                    {editingVehicle ? 'Update Vehicle' : 'Save Vehicle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delivery History Modal */}
        {historyVehicle && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                <div>
                  <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0D827D]" />
                    <span>Delivery Odometer History — {historyVehicle.registration_number}</span>
                  </h2>
                  <p className="text-[11px] text-[#72869A]">{historyVehicle.name} ({historyVehicle.vehicle_type})</p>
                </div>
                <button
                  onClick={() => setHistoryVehicle(null)}
                  className="p-1 text-[#72869A] hover:text-[#102C42]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
                {historyDeliveries.length > 0 ? (
                  historyDeliveries.map(del => (
                    <div
                      key={del.id}
                      className="p-3.5 rounded-xl border border-[#DCE5EB] bg-white hover:border-[#0D827D]/40 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#102C42] bg-[#F4F7FA] px-2 py-0.5 rounded border border-[#DCE5EB]">
                              {del.delivery_ref}
                            </span>
                            <span className="text-xs font-semibold text-[#102C42]">{del.customer_name}</span>
                            <span className="text-xs text-[#72869A]">({del.city})</span>
                          </div>
                          <p className="text-[11px] text-[#72869A] mt-0.5">
                            Driver: <strong className="text-[#102C42]">{del.driver_name}</strong> • Date: {formatDate(del.date, 'dd MMM yyyy')}
                          </p>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${del.status === 'completed' ? 'bg-green-50 text-[#16845B] border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {del.status === 'completed' ? 'Completed' : 'Awaiting Return'}
                        </span>
                      </div>

                      {/* Kilometre breakdown */}
                      <div className="grid grid-cols-3 gap-2 p-2 bg-[#F4F7FA] rounded-lg text-center text-xs">
                        <div>
                          <p className="text-[10px] text-[#72869A] uppercase font-bold">Out KM</p>
                          <p className="font-extrabold text-[#102C42]">{formatNumber(del.vehicle_out_km)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#72869A] uppercase font-bold">In KM</p>
                          <p className="font-extrabold text-[#102C42]">{del.vehicle_in_km ? formatNumber(del.vehicle_in_km) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#72869A] uppercase font-bold">Travelled</p>
                          <p className="font-extrabold text-[#0D827D]">
                            {del.distance_travelled !== null && del.distance_travelled !== undefined ? `${formatNumber(del.distance_travelled)} km` : 'Pending'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-[#72869A] text-xs">
                    No deliveries logged for vehicle {historyVehicle.registration_number} yet.
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
