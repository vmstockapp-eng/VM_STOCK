import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Warehouse as WarehouseIcon,
  LogOut, Save, Camera, Trash2, Upload
} from 'lucide-react'
import { StaffLayout } from '../../components/shared/StaffLayout'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import { getWarehouses, saveProfile } from '../../lib/dataService'
import { formatDate } from '../../lib/utils'
import { Avatar } from '../../components/ui/Avatar'

export default function StaffProfile() {
  const { profile, signOut, refreshProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const warehouses = getWarehouses()
  const assignedWarehouse = warehouses.find(w => w.id === profile?.warehouse_id)

  const [phone, setPhone] = useState(profile?.phone || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingImage, setIsSavingImage] = useState(false)

  // Handle Image File Selection & Validation
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validate MIME type
    if (!file.type.startsWith('image/')) {
      toast('error', 'Invalid File Type', 'Please upload a valid image file (PNG, JPG, JPEG, or WEBP).')
      return
    }

    // 2. Validate File Size (max 2MB)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024
    if (file.size > MAX_SIZE_BYTES) {
      toast('error', 'File Too Large', `Image size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 2 MB limit.`)
      return
    }

    // 3. Read as Data URL
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAvatarUrl(result)
      // Auto-save photo
      if (profile) {
        setIsSavingImage(true)
        try {
          saveProfile({
            ...profile,
            avatar_url: result
          })
          refreshProfile()
          toast('success', 'Profile Photo Updated', 'Your profile picture has been saved successfully.')
        } catch (err: any) {
          toast('error', 'Failed to Save Image', err.message || 'Error occurred while saving.')
        } finally {
          setIsSavingImage(false)
        }
      }
    }
    reader.onerror = () => {
      toast('error', 'Read Error', 'Failed to read image file. Please try another image.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    if (!profile) return
    setAvatarUrl(null)
    setIsSavingImage(true)
    try {
      saveProfile({
        ...profile,
        avatar_url: null
      })
      refreshProfile()
      toast('info', 'Photo Removed', 'Profile picture reset to default placeholder.')
    } catch (err: any) {
      toast('error', 'Failed to Remove', err.message)
    } finally {
      setIsSavingImage(false)
    }
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSaving(true)
    try {
      saveProfile({
        ...profile,
        phone,
        email,
        avatar_url: avatarUrl
      })
      refreshProfile()
      toast('success', 'Profile Updated', 'Contact information saved successfully.')
    } catch (err: any) {
      toast('error', 'Update Failed', err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <StaffLayout title="My Employee Profile">
      <div className="space-y-4 max-w-2xl mx-auto pb-12">
        {/* Profile Card Header with Uploadable Photo */}
        <div className="card border border-[#DCE5EB] bg-white rounded-2xl shadow-sm p-5 text-center">
          <div className="relative inline-block mx-auto mb-3">
            <Avatar
              src={avatarUrl}
              name={profile?.full_name}
              size="xl"
              className="border-2 border-[#0D827D]/40 shadow-md"
            />

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />

            {/* Camera upload button badge */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSavingImage}
              className="absolute bottom-0 right-0 p-2 bg-[#0D827D] hover:bg-[#09635f] text-white rounded-full shadow-md border-2 border-white transition-all active:scale-95"
              title="Upload profile picture"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSavingImage}
              className="text-xs font-bold text-[#0D827D] hover:underline inline-flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Change Photo</span>
            </button>
            {avatarUrl && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isSavingImage}
                  className="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              </>
            )}
          </div>

          <h2 className="text-base font-bold text-[#102C42]">{profile?.full_name}</h2>
          <p className="text-xs text-[#72869A] mt-0.5">@{profile?.username}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-[#E7F3F1] text-[#0D827D] px-2.5 py-0.5 rounded-full border border-teal-100">
              {profile?.role}
            </span>
            <span className="text-[11px] font-medium bg-green-50 text-[#16845B] px-2.5 py-0.5 rounded-full border border-green-200">
              Active Staff
            </span>
          </div>
        </div>

        {/* Assigned Location Information */}
        <div className="card border border-[#DCE5EB] bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#DCE5EB]">
            <WarehouseIcon className="w-4 h-4 text-[#0D827D]" />
            <h3 className="font-bold text-xs text-[#102C42] uppercase tracking-wider">
              Assigned Workplace
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#72869A]">Warehouse Location:</span>
              <span className="font-bold text-[#102C42]">
                {assignedWarehouse ? `${assignedWarehouse.name} (${assignedWarehouse.code})` : 'All Locations (Central)'}
              </span>
            </div>
            {assignedWarehouse?.address && (
              <div className="flex justify-between">
                <span className="text-[#72869A]">Yard Address:</span>
                <span className="text-[#102C42] text-right max-w-[200px]">{assignedWarehouse.address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#72869A]">Employee Joined:</span>
              <span className="text-[#102C42]">{formatDate(profile?.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Contact Information Form */}
        <div className="card border border-[#DCE5EB] bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#DCE5EB]">
            <User className="w-4 h-4 text-[#0D827D]" />
            <h3 className="font-bold text-xs text-[#102C42] uppercase tracking-wider">
              Contact Information
            </h3>
          </div>

          <form onSubmit={handleUpdate} className="space-y-3">
            <div>
              <label className="label">Full Name (Admin Managed)</label>
              <input
                type="text"
                disabled
                className="input-field bg-[#F4F7FA] text-xs cursor-not-allowed text-[#72869A] font-medium"
                value={profile?.full_name || ''}
              />
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input
                type="text"
                className="input-field text-xs font-medium"
                placeholder="+91 98000 00000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input-field text-xs font-medium"
                placeholder="name@stockflowpro.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 mt-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Contact Details</span>
            </button>
          </form>
        </div>

        {/* Sign Out Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-3 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Mobile Portal</span>
          </button>
        </div>
      </div>
    </StaffLayout>
  )
}
