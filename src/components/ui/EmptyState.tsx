import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-brand-tableHeader flex items-center justify-center mb-4 text-teal-DEFAULT">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-brand-textPrimary mb-1">{title}</h3>
      {description && <p className="text-sm text-brand-textSecondary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
