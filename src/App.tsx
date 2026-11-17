import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import { ToastProvider } from './store/ToastContext'
import Toast from './components/ui/Toast'
import ErrorBoundary from './components/shared/ErrorBoundary'

// Auth Pages
import LoginPage from './pages/auth/LoginPage'

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminCategories from './pages/admin/AdminCategories'
import AdminWarehouses from './pages/admin/AdminWarehouses'
import AdminStaff from './pages/admin/AdminStaff'
import AdminStockLedger from './pages/admin/AdminStockLedger'
import AdminReports from './pages/admin/AdminReports'
import AdminStockReport from './pages/admin/AdminStockReport'
import AdminRatesDiscounts from './pages/admin/AdminRatesDiscounts'
import AdminImportExport from './pages/admin/AdminImportExport'
import AdminAuditHistory from './pages/admin/AdminAuditHistory'
import AdminReconciliation from './pages/admin/AdminReconciliation'
import AdminMovements from './pages/admin/AdminMovements'
import AdminSettings from './pages/admin/AdminSettings'
import AdminVehicles from './pages/admin/AdminVehicles'
import AdminDeliveries from './pages/admin/AdminDeliveries'
import AdminInwardHistory from './pages/admin/AdminInwardHistory'

// Staff Pages
import StaffHome from './pages/staff/StaffHome'
import StaffStockHub from './pages/staff/StaffStockHub'
import StaffInwardEntry from './pages/staff/StaffInwardEntry'
import StaffOutwardDelivery from './pages/staff/StaffOutwardDelivery'
import StaffPhysicalCount from './pages/staff/StaffPhysicalCount'
import StaffMyEntries from './pages/staff/StaffMyEntries'
import StaffProfile from './pages/staff/StaffProfile'

// Operational admin roles: Admin and Manager have identical operational authority
const OP_ROLES = ['admin', 'manager', 'supervisor']

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#102C42] flex items-center justify-center mx-auto animate-pulse">
            <div className="w-6 h-6 bg-[#0D827D] rounded-lg" />
          </div>
          <p className="text-xs font-semibold text-[#72869A]">Loading VM Stock...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(profile.role)) {
    if (profile.role === 'staff') {
      return <Navigate to="/staff/home" replace />
    }
    return <Navigate to="/admin/dashboard" replace />
  }

  return <>{children}</>
}

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user || !profile) return <Navigate to="/login" replace />

  if (profile.role === 'staff') {
    return <Navigate to="/staff/home" replace />
  }
  return <Navigate to="/admin/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Root & Auth */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Admin & Manager Operational Portal Routes */}
      <Route
        path="/admin/dashboard"
        element={<ProtectedRoute roles={OP_ROLES}><AdminDashboard /></ProtectedRoute>}
      />
      <Route
        path="/admin/deliveries"
        element={<ProtectedRoute roles={OP_ROLES}><AdminDeliveries /></ProtectedRoute>}
      />
      <Route
        path="/admin/inward"
        element={<ProtectedRoute roles={OP_ROLES}><AdminInwardHistory /></ProtectedRoute>}
      />
      <Route
        path="/admin/vehicles"
        element={<ProtectedRoute roles={OP_ROLES}><AdminVehicles /></ProtectedRoute>}
      />
      <Route
        path="/admin/products"
        element={<ProtectedRoute roles={OP_ROLES}><AdminProducts /></ProtectedRoute>}
      />
      <Route
        path="/admin/categories"
        element={<ProtectedRoute roles={OP_ROLES}><AdminCategories /></ProtectedRoute>}
      />
      <Route
        path="/admin/warehouses"
        element={<ProtectedRoute roles={OP_ROLES}><AdminWarehouses /></ProtectedRoute>}
      />
      <Route
        path="/admin/staff"
        element={<ProtectedRoute roles={OP_ROLES}><AdminStaff /></ProtectedRoute>}
      />
      <Route
        path="/admin/stock-ledger"
        element={<ProtectedRoute roles={OP_ROLES}><AdminStockLedger /></ProtectedRoute>}
      />
      <Route
        path="/admin/reports"
        element={<ProtectedRoute roles={OP_ROLES}><AdminReports /></ProtectedRoute>}
      />
      <Route
        path="/admin/stock-report"
        element={<ProtectedRoute roles={OP_ROLES}><AdminStockReport /></ProtectedRoute>}
      />
      <Route
        path="/admin/rates-discounts"
        element={<ProtectedRoute roles={OP_ROLES}><AdminRatesDiscounts /></ProtectedRoute>}
      />
      <Route
        path="/admin/rates"
        element={<Navigate to="/admin/rates-discounts" replace />}
      />
      <Route
        path="/admin/import-export"
        element={<ProtectedRoute roles={OP_ROLES}><AdminImportExport /></ProtectedRoute>}
      />
      <Route
        path="/admin/audit-history"
        element={<ProtectedRoute roles={OP_ROLES}><AdminAuditHistory /></ProtectedRoute>}
      />
      <Route
        path="/admin/audit"
        element={<Navigate to="/admin/audit-history" replace />}
      />
      <Route
        path="/admin/reconciliation"
        element={<ProtectedRoute roles={OP_ROLES}><AdminReconciliation /></ProtectedRoute>}
      />
      <Route
        path="/admin/movements"
        element={<ProtectedRoute roles={OP_ROLES}><AdminMovements /></ProtectedRoute>}
      />
      <Route
        path="/admin/settings"
        element={<ProtectedRoute roles={OP_ROLES}><AdminSettings /></ProtectedRoute>}
      />
      {/* Approvals route redirect since approval workflow is removed */}
      <Route
        path="/admin/approvals"
        element={<Navigate to="/admin/dashboard" replace />}
      />

      {/* Staff Mobile Portal Routes */}
      <Route
        path="/staff/home"
        element={<ProtectedRoute><StaffHome /></ProtectedRoute>}
      />

      {/* Staff Stock Operations Hub */}
      <Route
        path="/staff/stock"
        element={<ProtectedRoute><StaffStockHub /></ProtectedRoute>}
      />

      {/* 1. Inward Stock Entry */}
      <Route
        path="/staff/inward"
        element={<ProtectedRoute><StaffInwardEntry /></ProtectedRoute>}
      />
      <Route
        path="/staff/stock-entry"
        element={<Navigate to="/staff/inward" replace />}
      />

      {/* 2. Outward Stock Entry */}
      <Route
        path="/staff/outward"
        element={<ProtectedRoute><StaffOutwardDelivery /></ProtectedRoute>}
      />
      <Route
        path="/staff/movements"
        element={<Navigate to="/staff/outward" replace />}
      />

      {/* 3. Manual Stock Entry */}
      <Route
        path="/staff/manual-entry"
        element={<ProtectedRoute><StaffPhysicalCount /></ProtectedRoute>}
      />
      <Route
        path="/staff/physical-count"
        element={<Navigate to="/staff/manual-entry" replace />}
      />

      {/* Staff Utilities */}
      <Route
        path="/staff/my-entries"
        element={<ProtectedRoute><StaffMyEntries /></ProtectedRoute>}
      />
      <Route
        path="/staff/profile"
        element={<ProtectedRoute><StaffProfile /></ProtectedRoute>}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
            <Toast />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
