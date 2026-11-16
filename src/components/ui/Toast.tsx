import React from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../store/ToastContext'
import { cn } from '../../lib/utils'
import type { ToastVariant } from '../../types'

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-brand-success" />,
  error: <XCircle className="w-5 h-5 text-brand-error" />,
  warning: <AlertTriangle className="w-5 h-5 text-brand-warning" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
}

const borders: Record<ToastVariant, string> = {
  success: 'border-l-4 border-brand-success',
  error: 'border-l-4 border-brand-error',
  warning: 'border-l-4 border-brand-warning',
  info: 'border-l-4 border-blue-500',
}

export default function Toast() {
  const { toasts, dismiss } = useToast()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'bg-white rounded-xl shadow-card-hover p-4 flex items-start gap-3 animate-in slide-in-from-right border border-brand-border',
            borders[t.variant]
          )}
        >
          <div className="shrink-0 mt-0.5">{icons[t.variant]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-textPrimary">{t.title}</p>
            {t.message && <p className="text-xs text-brand-textSecondary mt-0.5">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="shrink-0 text-brand-textSecondary hover:text-brand-textPrimary">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
