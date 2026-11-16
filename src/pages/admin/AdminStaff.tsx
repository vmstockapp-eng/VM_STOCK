  import React, { useState, useMemo, useRef, useEffect } from 'react'
  import {
    Users, Plus, Edit, Search, Shield, User, CheckCircle2,
    XCircle, Truck, Sparkles, Phone, BadgeCheck, X, Camera,
    Trash2
  } from 'lucide-react'
  import { AdminLayout } from '../../components/shared/AdminLayout'
  import { getSupabase } from '../../lib/supabase'
  import { useToast } from '../../store/ToastContext'
  import type { Profile, UserRole } from '../../types'
  import { Avatar } from '../../components/ui/Avatar'
  
  const supabase = getSupabase()
  export default function AdminStaff() {
    const { toast } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [staffList, setStaffList] = useState<Profile[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')

    const [modalOpen, setModalOpen] = useState(false)
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null)

    // Form Fields
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [role, setRole] = useState<UserRole>('staff')
    const [warehouseId, setWarehouseId] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [employeeId, setEmployeeId] = useState('')
    const [address, setAddress] = useState('')
    const [isActive, setIsActive] = useState(true)
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    const reloadEmployees = async () => {
      const { data, error } = await supabase.from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaffList((data || []) as Profile[])
    }

    useEffect(() => {
      let cancelled = false

      const loadPageData = async () => {
        setLoading(true)
        const [profilesResult, warehousesResult] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('warehouses').select('*').order('name', { ascending: true }),
        ])

        if (cancelled) return

        if (profilesResult.error) {
          toast('error', 'Could Not Load Staff', profilesResult.error.message)
        } else {
          setStaffList((profilesResult.data || []) as Profile[])
        }

        if (warehousesResult.error) {
          toast('error', 'Could Not Load Godowns', warehousesResult.error.message)
        } else {
          setWarehouses(warehousesResult.data || [])
        }

        setLoading(false)
      }

      void loadPageData()

      return () => {
        cancelled = true
      }
    }, [toast])

    const filteredStaff = useMemo(() => {
      return staffList.filter(s => {
        const matchSearch =
          s.full_name.toLowerCase().includes(search.toLowerCase()) ||
          s.username.toLowerCase().includes(search.toLowerCase()) ||
          (s.phone && s.phone.toLowerCase().includes(search.toLowerCase())) ||
          (s.employee_id && s.employee_id.toLowerCase().includes(search.toLowerCase())) ||
          (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
        const matchRole = roleFilter === 'all' || s.role === roleFilter
        return matchSearch && matchRole
      })
    }, [staffList, search, roleFilter])

    const openAddModal = () => {
      setEditingProfile(null)
      setFullName('')
      setUsername('')
      setNewPassword('')
      setRole('staff')
      setWarehouseId(warehouses[1]?.id || '')
      setPhone('')
      setEmail('')
      setEmployeeId('')
      setAddress('')
      setIsActive(true)
      setAvatarUrl(null)
      setModalOpen(true)
    }

    const openEditModal = (p: Profile) => {
      setEditingProfile(p)
      setFullName(p.full_name)
      setUsername(p.username)
      setNewPassword('')
      setRole(p.role)
      setWarehouseId(p.warehouse_id || '')
      setPhone(p.phone || '')
      setEmail(p.email || '')
      setEmployeeId(p.employee_id || '')
      setAddress(p.address || '')
      setIsActive(p.is_active)
      setAvatarUrl(p.avatar_url || null)
      setModalOpen(true)
    }

    const handleToggleStatus = async (p: Profile) => {
      try {
        const nextStatus = !p.is_active
        const { error } = await supabase
          .from('profiles')
          .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', p.id)

        if (error) throw error

        await reloadEmployees()
        toast('success', 'Status Changed', `${p.full_name} is now ${nextStatus ? 'Active' : 'Inactive'}.`)
      } catch (err: any) {
        toast('error', 'Status Update Failed', err?.message || 'Could not update employee status.')
      }
    }

    const handleDeleteStaff = async (p: Profile) => {
      if (p.role === 'admin') {
        toast('error', 'Delete Not Allowed', 'Admin accounts cannot be deleted from this screen.')
        return
      }

      const confirmed = window.confirm(
        `Delete ${p.full_name}? This permanently removes the employee login and profile. This action cannot be undone.`
      )
      if (!confirmed) return

      try {
        const { data, error } = await supabase.functions.invoke('delete-staff', {
          body: { user_id: p.user_id },
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        await reloadEmployees()
        toast('success', 'Employee Deleted', `${p.full_name} has been deleted.`)
      } catch (err: any) {
        toast(
          'error',
          'Delete Failed',
          err?.message || 'Could not delete this employee. Confirm that the delete-staff Edge Function is deployed.'
        )
      }
    }

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast('error', 'Invalid File Type', 'Please upload a valid image (PNG, JPG, or WEBP).')
        return
      }

      const MAX_SIZE_BYTES = 2 * 1024 * 1024
      if (file.size > MAX_SIZE_BYTES) {
        toast('error', 'File Too Large', `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 2 MB limit.`)
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        setAvatarUrl(reader.result as string)
        toast('success', 'Photo Selected', 'Image preview updated. Click Save Record to persist.')
      }
      reader.onerror = () => {
        toast('error', 'Read Error', 'Failed to read image file.')
      }
      reader.readAsDataURL(file)
    }

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault()

      const cleanName = fullName.trim()
      const cleanUsername = username.trim().toLowerCase()
      const cleanEmail = email.trim().toLowerCase()

      if (!cleanName || !cleanUsername || !cleanEmail) {
        toast('error', 'Missing Information', 'Full name, username, and email are required.')
        return
      }

      if (!editingProfile && newPassword.length < 8) {
        toast('error', 'Password Required', 'Set a password of at least 8 characters for the new employee.')
        return
      }

      if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
        toast('error', 'Invalid Username', 'Use 3–30 lowercase letters, numbers, dots, underscores, or hyphens.')
        return
      }

      const permissions = {
        can_approve: ['admin', 'manager', 'supervisor'].includes(role),
        can_export: ['admin', 'manager', 'supervisor'].includes(role),
        can_import: ['admin', 'manager'].includes(role),
        can_manage_rates: ['admin', 'manager'].includes(role),
        can_manage_users: role === 'admin',
      }

      setSaving(true)
      try {
        if (editingProfile) {
          const { error } = await supabase
            .from('profiles')
            .update({
              full_name: cleanName,
              username: cleanUsername,
              role,
              warehouse_id: warehouseId || null,
              phone: phone.trim() || null,
              employee_id: employeeId.trim() || null,
              address: address.trim() || null,
              avatar_url: avatarUrl,
              is_active: isActive,
              permissions,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingProfile.id)

          if (error) throw error
        } else {
          const { data, error } = await supabase.functions.invoke('create-staff', {
            body: {
              full_name: cleanName,
              username: cleanUsername,
              email: cleanEmail,
              password: newPassword,
              role,
              warehouse_id: warehouseId || null,
              phone: phone.trim() || null,
              employee_id: employeeId.trim() || null,
              address: address.trim() || null,
              is_active: isActive,
            },
          })

          if (error) throw error
          if (data?.error) throw new Error(data.error)

          // The deployed create-staff function creates the Auth user and profile.
          // Save the optional avatar after the profile has been created.
          if (avatarUrl && data?.user_id) {
            const { error: avatarError } = await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
              .eq('user_id', data.user_id)

            if (avatarError) {
              toast('info', 'Employee Created', 'The account was created, but the profile photo could not be saved.')
            }
          }
        }

        await reloadEmployees()
        setModalOpen(false)
        setNewPassword('')
        toast('success', editingProfile ? 'Employee Updated' : 'Employee Created', `${cleanName} saved successfully.`)
      } catch (err: any) {
        toast('error', 'Save Failed', err?.message || 'Could not save the employee.')
      } finally {
        setSaving(false)
      }
    }

    const getRoleBadge = (r: UserRole) => {
      switch (r) {
        case 'admin':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#102C42] text-white px-2 py-0.5 rounded-full">
              <Shield className="w-3 h-3 text-amber-300" /> Admin
            </span>
          )
        case 'manager':
        case 'supervisor':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-teal-50 text-[#0D827D] border border-teal-200 px-2 py-0.5 rounded-full">
              <BadgeCheck className="w-3 h-3" /> Manager
            </span>
          )
        case 'driver':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
              <Truck className="w-3 h-3" /> Driver
            </span>
          )
        case 'cleaner':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Cleaner
            </span>
          )
        case 'other':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
              Other Staff
            </span>
          )
        default:
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-[#102C42] border border-[#DCE5EB] px-2 py-0.5 rounded-full">
              <User className="w-3 h-3" /> Staff
            </span>
          )
      }
    }

    return (
      <AdminLayout title="Staff & Driver Management">
        <div className="space-y-4">
          {loading && (
            <div className="card p-4 border border-[#DCE5EB] bg-white rounded-xl text-sm text-[#72869A]">
              Loading staff and godown records from Supabase…
            </div>
          )}
          {/* Header & Quick Action */}
          <div className="card p-4 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-[#102C42] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0D827D]" />
                <span>Staff, Drivers & Operational Crew</span>
              </h1>
              <p className="text-xs text-[#72869A]">
                Manage godown staff, delivery drivers, cleaners, and operational supervisors
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="btn-primary text-xs flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Personnel</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="card p-3.5 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#72869A] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by name, driver ID, phone, username..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 text-xs"
              />
            </div>

            <div className="sm:w-56">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="input-field text-xs font-semibold"
              >
                <option value="all">All Roles ({staffList.length})</option>
                <option value="driver">Drivers Only ({staffList.filter(s => s.role === 'driver').length})</option>
                <option value="staff">Staff Only ({staffList.filter(s => s.role === 'staff').length})</option>
                <option value="manager">Managers ({staffList.filter(s => s.role === 'manager' || s.role === 'supervisor').length})</option>
                <option value="cleaner">Cleaners ({staffList.filter(s => s.role === 'cleaner').length})</option>
                <option value="admin">Admins ({staffList.filter(s => s.role === 'admin').length})</option>
              </select>
            </div>
          </div>

          {/* Mobile View: Cards */}
          <div className="block sm:hidden space-y-2.5">
            {filteredStaff.length > 0 ? (
              filteredStaff.map(s => {
                const wh = warehouses.find(w => w.id === s.warehouse_id)
                return (
                  <div key={s.id} className="card p-3.5 border border-[#DCE5EB] bg-white rounded-2xl shadow-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={s.avatar_url} name={s.full_name} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#102C42] truncate">{s.full_name}</h4>
                          <p className="text-[10px] text-[#72869A]">
                            {s.employee_id ? `ID: ${s.employee_id}` : `@${s.username}`}
                          </p>
                        </div>
                      </div>
                      {getRoleBadge(s.role)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#DCE5EB]">
                      <div>
                        <span className="text-[10px] text-[#72869A] block">Godown</span>
                        <span className="font-semibold text-[#102C42] truncate block">
                          {wh ? `${wh.name} (${wh.code})` : 'All Locations'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#72869A] block">Phone</span>
                        <span className="font-semibold text-[#102C42] truncate block">
                          {s.phone || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#DCE5EB]">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-50 text-[#16845B]' : 'bg-slate-100 text-slate-500'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(s)}
                          className="px-2.5 py-1 text-xs font-bold text-[#102C42] bg-[#F4F7FA] rounded-lg border border-[#DCE5EB]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${s.is_active ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-green-700 bg-green-50 border-green-200'}`}
                        >
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s)}
                          className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 rounded-lg border border-red-200"
                          title="Delete employee"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="card p-6 border border-[#DCE5EB] bg-white rounded-2xl text-center text-xs text-[#72869A]">
                No personnel found matching criteria.
              </div>
            )}
          </div>

          {/* Tablet & Desktop View: Table */}
          <div className="hidden sm:block card p-0 border border-[#DCE5EB] bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#E7F3F1] border-b border-[#DCE5EB] text-[#72869A] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Role / Type</th>
                    <th className="py-3 px-4">Assigned Yard</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE5EB]">
                  {filteredStaff.length > 0 ? (
                    filteredStaff.map(s => {
                      const wh = warehouses.find(w => w.id === s.warehouse_id)
                      return (
                        <tr key={s.id} className="hover:bg-[#F4F7FA]/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar src={s.avatar_url} name={s.full_name} size="sm" />
                              <div>
                                <p className="font-bold text-[#102C42]">{s.full_name}</p>
                                <p className="text-[11px] text-[#72869A]">
                                  {s.employee_id ? `ID: ${s.employee_id}` : `@${s.username}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {getRoleBadge(s.role)}
                          </td>

                          <td className="py-3.5 px-4 text-[#72869A]">
                            {wh ? `${wh.name} (${wh.code})` : 'All Locations / Central'}
                          </td>

                          <td className="py-3.5 px-4 text-[#72869A]">
                            {s.phone && (
                              <div className="flex items-center gap-1 font-medium text-[#102C42]">
                                <Phone className="w-3 h-3 text-[#0D827D]" />
                                <span>{s.phone}</span>
                              </div>
                            )}
                            {s.address && (
                              <p className="text-[10px] text-[#72869A] truncate max-w-xs">{s.address}</p>
                            )}
                            {!s.phone && !s.address && (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {s.is_active ? (
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
                                onClick={() => openEditModal(s)}
                                title="Edit profile"
                                className="p-1.5 text-[#102C42] hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(s)}
                                title={s.is_active ? 'Deactivate' : 'Activate'}
                                className={`p-1.5 rounded-lg transition-colors ${s.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                              >
                                {s.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(s)}
                                title="Delete employee"
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#72869A]">
                        No personnel found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Modal with Profile Image Upload */}
          {modalOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-[#DCE5EB] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-[#DCE5EB] flex items-center justify-between bg-[#F4F7FA]">
                  <h2 className="text-sm font-bold text-[#102C42] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0D827D]" />
                    <span>{editingProfile ? 'Edit Employee Record' : 'Register New Personnel'}</span>
                  </h2>
                  <button onClick={() => setModalOpen(false)} className="p-1 text-[#72869A] hover:text-[#102C42]">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
                  {/* Profile Image Upload Row */}
                  <div className="p-3 bg-[#F4F7FA] rounded-2xl border border-[#DCE5EB] flex items-center gap-3.5">
                    <Avatar
                      src={avatarUrl}
                      name={fullName || 'Staff'}
                      size="lg"
                      className="border-2 border-[#0D827D]/30"
                    />

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-[#102C42] block">Profile Photo</span>
                      <p className="text-[10px] text-[#72869A]">PNG, JPG, or WEBP (Max 2MB)</p>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />

                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-bold text-[#0D827D] hover:underline inline-flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        </button>
                        {avatarUrl && (
                          <>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => setAvatarUrl(null)}
                              className="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh Pawar"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        required
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="label">Employee Type / Role *</label>
                      <select
                        value={role}
                        onChange={e => setRole(e.target.value as UserRole)}
                        className="input-field font-semibold"
                      >
                        <option value="driver">Driver (Appears in Outward Dropdown)</option>
                        <option value="staff">Staff (Mobile Portal Entry)</option>
                        <option value="manager">Manager (Full Operational Authority)</option>
                        <option value="cleaner">Cleaner (Yard Maintenance)</option>
                        <option value="other">Other Employee</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>

                  {/* Every profile needs a real Supabase Auth user because profiles.user_id is required. */}
                  <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-200/60 space-y-2.5">
                    <p className="text-[11px] font-bold text-[#0D827D] uppercase tracking-wider">
                      Employee Login Credentials
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label text-[#102C42]">Username *</label>
                        <input
                          type="text"
                          placeholder="e.g. ramesh.patil"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          required
                          className="input-field text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="label text-[#102C42]">Email Address *</label>
                        <input
                          type="email"
                          placeholder="e.g. ramesh@company.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          disabled={Boolean(editingProfile)}
                          className="input-field text-xs disabled:opacity-60"
                        />
                      </div>
                      {!editingProfile && (
                        <div className="sm:col-span-2">
                          <label className="label text-[#102C42]">Temporary Password *</label>
                          <input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Minimum 8 characters"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            minLength={8}
                            required
                            className="input-field text-xs"
                          />
                          <p className="mt-1 text-[10px] text-slate-500">
                            Share this password securely with the employee.
                          </p>
                        </div>
                      )}
                    </div>
                    {editingProfile && (
                      <p className="text-[10px] text-slate-500">
                        Email and password changes are not handled by this edit form.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Contact Phone Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. +91 98221 33445"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="label">Employee Badge / ID</label>
                      <input
                        type="text"
                        placeholder="e.g. DRV-004"
                        value={employeeId}
                        onChange={e => setEmployeeId(e.target.value)}
                        className="input-field uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Assigned Working Godown</label>
                    <select
                      value={warehouseId}
                      onChange={e => setWarehouseId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">All Locations / Floating Yard</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Home Address / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Sector 24, Pradhikaran, Nigdi, Pune"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="emp-active"
                      checked={isActive}
                      onChange={e => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#0D827D] rounded border-[#DCE5EB] focus:ring-[#0D827D]"
                    />
                    <label htmlFor="emp-active" className="text-xs font-bold text-[#102C42]">
                      Active employee (available for dispatch selection)
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE5EB]">
                    <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-60 disabled:cursor-not-allowed">
                      {saving ? 'Saving…' : editingProfile ? 'Update Record' : 'Create Login & Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    )
  }
