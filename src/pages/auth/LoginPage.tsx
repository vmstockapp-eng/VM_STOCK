import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Eye, EyeOff, AlertCircle, Database } from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../store/ToastContext'
import type { UserRole } from '../../types'
import { isSupabaseConfigured } from '../../lib/dataService'

const schema = z.object({
  email: z.string().min(1, 'Please enter email or username'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { signIn, authError } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const supabaseConfigured = isSupabaseConfigured()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const routeUser = (role: UserRole) => {
    if (role === 'admin' || role === 'manager' || role === 'supervisor') {
      navigate('/admin/dashboard')
    } else {
      navigate('/staff/home')
    }
  }

  const onSubmit = async (data: FormData) => {
    setServerError('')
    const { error, role } = await signIn(data.email, data.password)
    if (error) {
      setServerError(error)
      return
    }
    if (!role) {
      setServerError('Your account does not have an assigned role. Contact an administrator.')
      return
    }
    toast('success', 'Welcome back!', 'Successfully signed in.')
    routeUser(role)
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        
      {/* Brand Logo & Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-navy-DEFAULT shadow-card mb-3 overflow-hidden">
          <img
            src="/logo.png"
            alt="VM Stock Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-2xl font-bold text-navy-DEFAULT tracking-tight">
          VM Stock
        </h1>

        <p className="text-xs text-brand-textSecondary mt-1">
          Wholesale Pipes &amp; Fittings Inventory Management
        </p>
      </div>


        {/* Login Card */}
        <div className="card shadow-card-hover border-brand-border">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-brand-border">
            <div>
              <h2 className="text-base font-bold text-brand-textPrimary">Sign In</h2>
              <p className="text-xs text-brand-textSecondary">Access your warehouse dashboard</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              supabaseConfigured
                ? 'bg-green-50 text-brand-success border border-green-200'
                : 'bg-amber-50 text-brand-warning border border-amber-200'
            }`}>
              <Database className="w-3 h-3" />
              {supabaseConfigured ? 'Authentication' : 'Database Not Configured'}
            </span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="text"
                className="input-field"
                placeholder="name@company.com"
                autoComplete="username"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-brand-error mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-textSecondary hover:text-brand-textPrimary p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-brand-error mt-1">{errors.password.message}</p>}
            </div>

            {(serverError || authError) && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-brand-error text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{serverError || authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !supabaseConfigured}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 font-semibold shadow-sm"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In to Portal'}
            </button>
          </form>
        </div>

        {/* Security & System Info */}
        <div className="text-center mt-6 text-[11px] text-brand-textSecondary">
          <p>Multi-location stock register for PVC, HDPE, SWR, CPVC & Water Tanks</p>
          <p className="mt-1 text-navy-100 font-medium">VM Stock © 2026 • Enterprise Grade Security</p>
        </div>
      </div>
    </div>
  )
}
