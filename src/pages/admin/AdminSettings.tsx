import React, { useState } from 'react'
import {
  Database, Building, CheckCircle2, Info
} from 'lucide-react'
import { AdminLayout } from '../../components/shared/AdminLayout'
import { useToast } from '../../store/ToastContext'
import { isSupabaseConfigured } from '../../lib/dataService'

export default function AdminSettings() {
  const { toast } = useToast()

  const [companyName, setCompanyName] = useState('')
  const [gstin, setGstin] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isConnected = isSupabaseConfigured()

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault()
    toast('error', 'Settings Not Saved', 'Business settings are not connected to Supabase yet.')
  }

  return (
    <AdminLayout title="System & Business Settings">
      <div className="space-y-6 max-w-4xl">
        {/* Supabase Connection Status Card */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brand-border">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-teal-DEFAULT" />
              <div>
                <h3 className="font-bold text-sm text-navy-DEFAULT">Database & Backend Architecture</h3>
                <p className="text-xs text-brand-textSecondary">PostgreSQL & Supabase Row-Level-Security (RLS)</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isConnected
                ? 'bg-green-100 text-brand-success border border-green-200'
                : 'bg-amber-100 text-brand-warning border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-amber-500 animate-pulse'}`}></span>
              {isConnected ? 'Credentials Configured' : 'Supabase Not Configured'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-brand-bg rounded-xl border border-brand-border space-y-1">
              <div className="flex justify-between">
                <span className="text-brand-textSecondary">Backend Engine:</span>
                <span className="font-bold text-navy-DEFAULT">
                  {isConnected ? 'Supabase credentials detected; connection not verified' : 'Supabase PostgreSQL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textSecondary">Supabase URL:</span>
                <span className="font-mono text-navy-DEFAULT truncate max-w-[280px]">
                  {supabaseUrl || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textSecondary">Migrations Prepared:</span>
                <span className="font-semibold text-teal-DEFAULT">
                  001_initial_schema.sql • additive migrations • create_admin.sql
                </span>
              </div>
            </div>

            {!isConnected ? (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-brand-textPrimary space-y-2">
                <div className="flex items-center gap-2 text-brand-warning font-bold text-xs">
                  <Info className="w-4 h-4" />
                  <span>Supabase setup required:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-[11px] text-brand-textSecondary">
                  <li>Set the project root URL and publishable/anon key as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
                  <li>Apply only reviewed, additive schema migrations. Do not run sample seed scripts against production.</li>
                  <li>Create or invite staff accounts through Supabase Auth and assign their profile roles.</li>
                </ol>
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-brand-success text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Supabase credentials are present. Operational database access has not been verified.</span>
              </div>
            )}
          </div>
        </div>

        {/* Business Entity Profile */}
        <div className="card border border-brand-border bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-brand-border">
            <Building className="w-5 h-5 text-teal-DEFAULT" />
            <div>
              <h3 className="font-bold text-sm text-navy-DEFAULT">Company & Wholesale Entity Profile</h3>
              <p className="text-xs text-brand-textSecondary">Appears on stock transfer delivery challans and registers</p>
            </div>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Registered Business Legal Name</label>
                <input
                  type="text"
                  className="input-field text-xs font-semibold"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
              </div>

              <div>
                <label className="label">GSTIN Identification Number</label>
                <input
                  type="text"
                  className="input-field text-xs font-bold uppercase"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Operations Phone Number</label>
                <input
                  type="text"
                  className="input-field text-xs"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Official Invoicing Email</label>
                <input
                  type="email"
                  className="input-field text-xs"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Central Head Office Yard Address</label>
              <textarea
                rows={2}
                className="input-field text-xs resize-none"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold">
                Save Business Profile
              </button>
            </div>
          </form>
        </div>

      </div>
    </AdminLayout>
  )
}
