import React, { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, Layers, User, LogOut, ChevronDown, ArrowLeft, Shield, Warehouse, Package } from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { cn } from '../../lib/utils'
import { getWarehouses } from '../../lib/dataService'
import { Avatar } from '../ui/Avatar'

interface StaffLayoutProps {
  children: React.ReactNode
  title?: string
  showBackButton?: boolean
  onBack?: () => void
}

const navItems = [
  { label: 'Home', to: '/staff/home', icon: Home },
  { label: 'Stock', to: '/staff/stock', icon: Layers },
  { label: 'Profile', to: '/staff/profile', icon: User },
]

export function StaffLayout({ children, title, showBackButton = false, onBack }: StaffLayoutProps) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const warehouses = getWarehouses()
  const assignedWarehouse = warehouses.find(w => w.id === profile?.warehouse_id)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between max-w-2xl mx-auto border-x border-[#DCE5EB] shadow-sm relative">
      {/* Top Mobile Header */}
      <header className="bg-[#102C42] text-white sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Back or Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            {showBackButton ? (
              <button
                onClick={onBack ? onBack : () => navigate(-1)}
                className="p-1 -ml-1 text-slate-300 hover:text-white rounded-lg active:scale-95 transition-transform"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#0D827D] flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white truncate">StockFlow Pro</span>
                {assignedWarehouse && (
                  <span className="text-[10px] bg-[#0D827D]/40 text-teal-200 px-1.5 py-0.2 rounded border border-[#0D827D]/60 truncate hidden sm:inline-block">
                    {assignedWarehouse.code}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-300 truncate">
                {assignedWarehouse ? assignedWarehouse.name : 'Central Inventory'}
              </p>
            </div>
          </div>

          {/* Right: Staff Avatar with dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 bg-[#1A3D59] hover:bg-[#234E70] rounded-full pl-1.5 pr-2.5 py-1 transition-colors border border-[#234E70] active:scale-95"
            >
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size="xs" />
              <span className="text-xs font-medium text-white max-w-[80px] truncate hidden xs:block">
                {profile?.full_name?.split(' ')[0] ?? 'Staff'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card-hover border border-[#DCE5EB] z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-[#DCE5EB] flex items-center gap-3">
                  <Avatar src={profile?.avatar_url} name={profile?.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#20384A] truncate">{profile?.full_name}</p>
                    <p className="text-[11px] text-[#72869A] truncate">@{profile?.username}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#E7F3F1] text-[#0D827D] px-2 py-0.5 rounded-full border border-teal-100">
                        {profile?.role}
                      </span>
                      {assignedWarehouse && (
                        <span className="text-[10px] text-[#72869A] truncate">
                          • {assignedWarehouse.code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/staff/profile') }}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#20384A] hover:bg-[#F4F7FA] transition-colors"
                  >
                    <User className="w-4 h-4 text-[#72869A]" />
                    <span>My Profile</span>
                  </button>

                  {(profile?.role === 'admin' || profile?.role === 'supervisor') && (
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/admin/dashboard') }}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#20384A] hover:bg-[#F4F7FA] transition-colors"
                    >
                      <Shield className="w-4 h-4 text-[#0D827D]" />
                      <span>Admin Laptop Portal</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-[#DCE5EB] pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-[#DC4C4C] hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page Title Bar if specified */}
        {title && (
          <div className="mt-2 pt-2 border-t border-[#1A3D59] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
            {assignedWarehouse && (
              <span className="text-[11px] text-slate-300 flex items-center gap-1">
                <Warehouse className="w-3 h-3 text-teal-200" />
                {assignedWarehouse.name}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full pb-20 pt-2 px-3 sm:px-4 bg-[#F4F7FA]">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t border-[#DCE5EB] shadow-lg z-30 mobile-safe-bottom">
        <div className="grid grid-cols-3 h-14">
          {navItems.map(item => {
            const active = location.pathname.startsWith(item.to)
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors select-none active:scale-95',
                  active
                    ? 'text-[#0D827D] font-bold'
                    : 'text-[#72869A] hover:text-[#102C42]'
                )}
              >
                <div className={cn(
                  'p-1 rounded-xl transition-colors',
                  active ? 'bg-[#E7F3F1]' : 'bg-transparent'
                )}>
                  <Icon className={cn('w-5 h-5', active ? 'text-[#0D827D] stroke-[2.5]' : 'text-[#72869A]')} />
                </div>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default StaffLayout
