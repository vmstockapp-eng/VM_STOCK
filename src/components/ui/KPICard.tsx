import React from 'react'
import { cn } from '../../lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type KPIColor = 'teal' | 'navy' | 'success' | 'warning' | 'error'

interface KPICardProps {
  title: string
  value: string | number
  icon?: React.ReactNode
  trend?: number
  trendLabel?: string
  color?: KPIColor
  className?: string
}

const colorMap: Record<KPIColor, string> = {
  teal: 'bg-teal-50 text-teal-DEFAULT',
  navy: 'bg-navy-50 text-navy-DEFAULT',
  success: 'bg-green-100 text-brand-success',
  warning: 'bg-amber-100 text-brand-warning',
  error: 'bg-red-100 text-brand-error',
}

export default function KPICard({ title, value, icon, trend, trendLabel, color = 'teal', className }: KPICardProps) {
  return (
    <div className={cn('card flex items-start gap-4', className)}>
      {icon && (
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colorMap[color])}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="label">{title}</p>
        <p className="text-2xl font-bold text-brand-textPrimary truncate">{value}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-brand-success" />
            ) : trend < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-brand-error" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-brand-textSecondary" />
            )}
            <span className={cn(
              'text-xs font-medium',
              trend > 0 ? 'text-brand-success' : trend < 0 ? 'text-brand-error' : 'text-brand-textSecondary'
            )}>
              {trend > 0 ? '+' : ''}{trend}% {trendLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
