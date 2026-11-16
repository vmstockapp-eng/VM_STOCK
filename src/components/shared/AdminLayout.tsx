import React, { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, RefreshCw, Package, Tag,
  Warehouse, Users, Percent, BarChart2, Upload, ArrowLeftRight,
  History, Settings, Menu, X, ChevronDown, LogOut,
  Smartphone, Database, Truck, ArrowDownLeft, FileSpreadsheet
} from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { cn } from '../../lib/utils'
import { format } from 'date-fns'
import { Avatar } from '../ui/Avatar'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Deliveries', to: '/admin/deliveries', icon: <Truck className="w-4 h-4" /> },
  { label: 'Inward History', to: '/admin/inward', icon: <ArrowDownLeft className="w-4 h-4" /> },
  { label: 'Vehicles', to: '/admin/vehicles', icon: <Truck className="w-4 h-4" /> },
  { label: 'Stock Ledger', to: '/admin/stock-ledger', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Current Stock Report', to: '/admin/stock-report', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { label: 'Products', to: '/admin/products', icon: <Package className="w-4 h-4" /> },
  { label: 'Categories', to: '/admin/categories', icon: <Tag className="w-4 h-4" /> },
  { label: 'Warehouses', to: '/admin/warehouses', icon: <Warehouse className="w-4 h-4" /> },
  { label: 'Staff & Drivers', to: '/admin/staff', icon: <Users className="w-4 h-4" /> },
  { label: 'Rates & Discounts', to: '/admin/rates-discounts', icon: <Percent className="w-4 h-4" /> },
  { label: 'Reports', to: '/admin/reports', icon: <BarChart2 className="w-4 h-4" /> },
  { label: 'Import / Export', to: '/admin/import-export', icon: <Upload className="w-4 h-4" /> },
  { label: 'Movements', to: '/admin/movements', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { label: 'Reconciliation', to: '/admin/reconciliation', icon: <RefreshCw className="w-4 h-4" /> },
  { label: 'Audit History', to: '/admin/audit-history', icon: <History className="w-4 h-4" /> },
  { label: 'Settings', to: '/admin/settings', icon: <Settings className="w-4 h-4" /> },
]

function getPageTitle(pathname: string): string {
  const item = navItems.find(n => pathname.startsWith(n.to))
  return item?.label ?? 'Admin Portal'
}

interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [todayFormatted] = useState(() => format(new Date(), 'EEEE, dd MMMM yyyy'))
  const profileRef = useRef<HTMLDivElement>(null)

  const pageTitle = title || getPageTitle(location.pathname)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-[#102C42] text-white">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1A3D59] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0D827D] flex items-center justify-center font-bold text-white shadow-sm">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">StockFlow</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0D827D]/30 text-teal-200 border border-[#0D827D]/50">PRO</span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">Wholesale Pipes & Fittings</p>
          </div>
        </div>
        <button
          className="lg:hidden text-slate-300 hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors',
                isActive
                  ? 'bg-[#0D827D] text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-[#1A3D59] hover:text-white'
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Switch to Staff Portal */}
      <div className="p-3 border-t border-[#1A3D59] space-y-2">
        <button
          onClick={() => navigate('/staff/home')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1A3D59] hover:bg-[#234E70] text-teal-200 transition-colors border border-[#234E70]"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#0D827D]" />
          <span>Switch to Staff Mobile View</span>
        </button>

      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-[#1A3D59]">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{profile?.full_name ?? 'Admin User'}</p>
            <p className="text-[11px] text-slate-300 capitalize truncate">{profile?.role ?? 'admin'}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-[#1A3D59]"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#F4F7FA] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#102C42] border-r border-[#0A1E32]">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 max-w-[85vw] z-10 flex flex-col h-full bg-[#102C42] shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-[#DCE5EB] px-4 py-3 flex items-center gap-4 shrink-0">
          <button
            className="lg:hidden text-[#72869A] hover:text-[#20384A] p-1.5 rounded-lg hover:bg-[#F4F7FA]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[#20384A] text-base truncate">{pageTitle}</h1>
              <span
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-[#D97706] border border-amber-200"
                title="Operational records are not yet synchronized to Supabase."
              >
                <Database className="w-3 h-3 text-[#D97706]" />
                Local records
              </span>
            </div>
            <p className="text-xs text-[#72869A]">{todayFormatted}</p>
          </div>

          {/* Quick Staff Mode Link for laptops */}
          <button
            onClick={() => navigate('/staff/home')}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-[#102C42] bg-[#F4F7FA] hover:bg-[#DCE5EB]/60 px-3 py-1.5 rounded-xl border border-[#DCE5EB] transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#0D827D]" />
            <span>Staff Portal</span>
          </button>

          {/* Profile Menu */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileMenuOpen(p => !p)}
              className="flex items-center gap-2 hover:bg-[#F4F7FA] rounded-xl px-2 py-1.5 transition-colors border border-transparent hover:border-[#DCE5EB]"
            >
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
              <div className="text-left hidden sm:block">
                <span className="block text-xs font-semibold text-[#20384A] truncate max-w-[120px]">
                  {profile?.full_name ?? 'Admin'}
                </span>
                <span className="block text-[10px] text-[#72869A] capitalize">
                  {profile?.role ?? 'admin'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#72869A]" />
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-card-hover border border-[#DCE5EB] z-50 py-1.5">
                <div className="px-4 py-2.5 border-b border-[#DCE5EB]">
                  <p className="text-xs font-bold text-[#20384A]">{profile?.full_name}</p>
                  <p className="text-[11px] text-[#72869A]">{profile?.email || '—'}</p>
                  <span className="inline-block mt-1 text-[10px] bg-[#E7F3F1] text-[#0D827D] font-bold px-2 py-0.5 rounded-full capitalize">
                    {profile?.role}
                  </span>
                </div>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/admin/settings') }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#20384A] hover:bg-[#F4F7FA] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#72869A]" /> Business Settings
                </button>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/staff/home') }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#20384A] hover:bg-[#F4F7FA] transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-[#0D827D]" /> Switch to Staff Mobile
                </button>
                <div className="border-t border-[#DCE5EB] my-1" />
                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#DC4C4C] hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F4F7FA]">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
