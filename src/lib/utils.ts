import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | undefined | null, fmt = 'dd MMM yyyy') {
  if (!date) return '-'
  try {
    return format(new Date(date), fmt)
  } catch {
    return String(date)
  }
}

export function formatDateTime(date: string | Date | undefined | null) {
  if (!date) return '-'
  try {
    return format(new Date(date), 'dd MMM yyyy, hh:mm a')
  } catch {
    return String(date)
  }
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '₹0.00'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
}

export function generateRef(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${prefix}-${ts}-${rnd}`
}

export function calcClosingStock(opening: number, inward: number, outward: number): number {
  return (Number(opening) || 0) + (Number(inward) || 0) - (Number(outward) || 0)
}

export function getUnitLabel(unit: string | undefined | null): string {
  if (!unit) return 'Pcs'
  const map: Record<string, string> = {
    piece: 'Pcs',
    coil: 'Coil',
    metre: 'Mtr',
    tank: 'Tank',
    box: 'Box',
    kg: 'Kg',
    litre: 'Ltr'
  }
  return map[unit.toLowerCase()] || unit
}

export function getStatusColor(status: string | undefined | null): string {
  if (!status) return 'badge-info'
  const map: Record<string, string> = {
    draft: 'badge-warning',
    submitted: 'badge-info',
    under_review: 'badge-info',
    approved: 'badge-success',
    posted: 'badge-success',
    rejected: 'badge-error',
    pending: 'badge-warning',
    matched: 'badge-success',
    discrepancy: 'badge-error',
    active: 'badge-success',
    inactive: 'badge-error'
  }
  return map[status.toLowerCase()] || 'badge-info'
}
