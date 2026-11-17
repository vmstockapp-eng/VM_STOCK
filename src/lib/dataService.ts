import type {
  Profile, Warehouse, Category, Product, StockBalance, StockMovement,
  DailyStockReport, DailyStockReportLine, PhysicalCount, PhysicalCountLine,
  ApprovalRequest, PriceRule, AuditLog, UserRole,
  Vehicle, OutwardDelivery, DeliveryItem, InwardStockEntry, InwardStockLine, DeliveryStatus
} from '../types'
import { generateRef, calcClosingStock, getUnitLabel } from './utils'
import { getSupabase } from './supabase'
export { isSupabaseConfigured } from './supabase'

const EMPTY_WAREHOUSES: Warehouse[] = []
const EMPTY_CATEGORIES: Category[] = []
const EMPTY_PRODUCTS: Product[] = []
const EMPTY_PROFILES: Profile[] = []
const EMPTY_VEHICLES: Vehicle[] = []
const EMPTY_DELIVERIES: OutwardDelivery[] = []
const EMPTY_INWARD_ENTRIES: InwardStockEntry[] = []
const EMPTY_REPORTS: DailyStockReport[] = []
const EMPTY_MOVEMENTS: StockMovement[] = []
const EMPTY_PHYSICAL_COUNTS: PhysicalCount[] = []
const EMPTY_APPROVALS: ApprovalRequest[] = []
const EMPTY_PRICE_RULES: PriceRule[] = []
const EMPTY_AUDIT_LOGS: AuditLog[] = []
// ==================== LOCAL STORAGE HELPERS ====================
const STORAGE_PREFIX = 'stockflow_'

function getStore<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return defaultVal
    return JSON.parse(raw) as T
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown browser storage error.'
    throw new Error(`Unable to read local records for "${key}": ${detail}`)
  }
}

function setStore<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val))
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown browser storage error.'
    throw new Error(`Unable to save local records for "${key}": ${detail}`)
  }
}

/**
 * Refresh the shared catalog cache used by legacy synchronous staff screens.
 * Admin catalog screens write to Supabase, so reading only localStorage caused
 * staff accounts/devices to see empty categories, warehouses, products and stock.
 */
export async function hydrateCatalogCacheFromSupabase(): Promise<void> {
  const supabase = getSupabase()
  const [categoriesResult, warehousesResult, productsResult, balancesResult, inwardResult, outwardResult, movementsResult] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('warehouses').select('*').order('name'),
    supabase.from('products').select('*, category:categories(*)').order('sku'),
    supabase.from('stock_balances').select('*'),
    supabase.from('inward_stock_entries').select('*, lines:inward_stock_lines(*)').order('created_at', { ascending: false }),
    supabase.from('outward_deliveries').select('*, items:delivery_items(*)').order('created_at', { ascending: false }),
    supabase.from('stock_movements').select('*').order('created_at', { ascending: false })
  ])

  const failures: string[] = []
  if (categoriesResult.error) failures.push(`categories: ${categoriesResult.error.message}`)
  else setStore('categories', categoriesResult.data ?? [])

  if (warehousesResult.error) failures.push(`warehouses: ${warehousesResult.error.message}`)
  else setStore('warehouses', warehousesResult.data ?? [])

  if (productsResult.error) failures.push(`products: ${productsResult.error.message}`)
  else setStore('products', productsResult.data ?? [])

  if (balancesResult.error) failures.push(`stock balances: ${balancesResult.error.message}`)
  else setStore('stock_balances', (balancesResult.data ?? []).map(row => ({
    ...row,
    quantity: Number(row.quantity) || 0
  })))

  // Populate legacy synchronous screens from the shared database. These records
  // used to exist only in each browser's localStorage.
  if (inwardResult.error) failures.push(`inward entries: ${inwardResult.error.message}`)
  else setStore('inward_entries', (inwardResult.data ?? []).map((row: any) => ({
    ...row,
    entry_date: row.entry_date,
    status: row.status === 'saved' ? 'saved' : 'draft',
    lines: (row.lines ?? []).map((line: any) => ({ ...line, quantity: Number(line.quantity) || 0 }))
  })))

  if (outwardResult.error) failures.push(`outward deliveries: ${outwardResult.error.message}`)
  else setStore('deliveries', (outwardResult.data ?? []).map((row: any) => ({
    ...row,
    date: row.delivery_date,
    dispatch_timestamp: row.dispatch_timestamp ?? row.created_at,
    vehicle_out_km: Number(row.vehicle_out_km) || 0,
    vehicle_in_km: row.vehicle_in_km == null ? null : Number(row.vehicle_in_km),
    distance_travelled: row.distance_travelled == null ? null : Number(row.distance_travelled),
    items: (row.items ?? []).map((item: any) => ({ ...item, delivery_id: row.id, quantity: Number(item.quantity) || 0 }))
  })))

  if (movementsResult.error) failures.push(`stock movements: ${movementsResult.error.message}`)
  else setStore('movements', (movementsResult.data ?? []).map((row: any) => ({
    ...row,
    quantity: Number(row.quantity) || 0,
    creator_name: row.creator_name ?? row.created_by
  })))

  if (failures.length) {
    throw new Error(`Unable to refresh shared inventory data from Supabase — ${failures.join('; ')}`)
  }
}

// ==================== REPOSITORY METHODS ====================

// Profiles
export function saveProfile(profile: Profile): Profile {
  const profiles = getStore<Profile[]>('profiles', EMPTY_PROFILES)
  const idx = profiles.findIndex(p => p.id === profile.id)
  if (idx >= 0) {
    profiles[idx] = { ...profile, updated_at: new Date().toISOString() }
  } else {
    profiles.push({ ...profile, id: profile.id || `usr-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  setStore('profiles', profiles)
  logAudit({
    actor_id: profile.id,
    actor_name: profile.full_name,
    actor_role: profile.role,
    action: idx >= 0 ? 'UPDATE_STAFF' : 'CREATE_STAFF',
    entity_type: 'Profile',
    entity_reference: profile.username,
    result: 'success',
    change_summary: `${idx >= 0 ? 'Updated' : 'Created'} profile for ${profile.full_name} (${profile.role})`
  })
  return profile
}

// Warehouses
export function getWarehouses(): Warehouse[] {
  return getStore<Warehouse[]>('warehouses', EMPTY_WAREHOUSES)
}

export function saveWarehouse(wh: Warehouse): Warehouse {
  const list = getWarehouses()
  const idx = list.findIndex(w => w.id === wh.id)
  if (idx >= 0) {
    list[idx] = { ...wh, updated_at: new Date().toISOString() }
  } else {
    list.push({ ...wh, id: wh.id || `w-${Date.now()}`, created_at: new Date().toISOString() })
  }
  setStore('warehouses', list)
  return wh
}

// Categories
export function getCategories(): Category[] {
  return getStore<Category[]>('categories', EMPTY_CATEGORIES).sort((a, b) => a.sort_order - b.sort_order)
}

export function saveCategory(cat: Category): Category {
  const list = getCategories()
  const idx = list.findIndex(c => c.id === cat.id)
  if (idx >= 0) {
    list[idx] = { ...cat, updated_at: new Date().toISOString() }
  } else {
    list.push({ ...cat, id: cat.id || `c-${Date.now()}`, created_at: new Date().toISOString() })
  }
  setStore('categories', list)
  return cat
}

// Products
export function getProducts(): Product[] {
  const cats = getCategories()
  const products = getStore<Product[]>('products', EMPTY_PRODUCTS)
  return products.map(p => ({
    ...p,
    category: cats.find(c => c.id === p.category_id)
  }))
}

export function getProductById(id: string): Product | undefined {
  return getProducts().find(p => p.id === id)
}

export function saveProduct(prod: Product): Product {
  const list = getStore<Product[]>('products', EMPTY_PRODUCTS)
  const idx = list.findIndex(p => p.id === prod.id)
  if (idx >= 0) {
    list[idx] = { ...prod, updated_at: new Date().toISOString() }
  } else {
    list.push({ ...prod, id: prod.id || `p-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }
  setStore('products', list)
  return prod
}

export function deleteProduct(id: string): void {
  const list = getStore<Product[]>('products', EMPTY_PRODUCTS).filter(p => p.id !== id)
  setStore('products', list)
}

// Stock Balances
export function getStockBalances(warehouseId?: string): StockBalance[] {
  const prods = getProducts()
  const whs = getWarehouses()
  let balances = getStore<StockBalance[]>('stock_balances', [])

  if (warehouseId) {
    balances = balances.filter(b => b.warehouse_id === warehouseId)
  }

  return balances.map(b => ({
    ...b,
    product: prods.find(p => p.id === b.product_id),
    warehouse: whs.find(w => w.id === b.warehouse_id)
  }))
}

export function getProductStockBalance(productId: string, warehouseId: string): number {
  const balances = getStore<StockBalance[]>('stock_balances', [])
  const found = balances.find(b => b.product_id === productId && b.warehouse_id === warehouseId)
  return found ? found.quantity : 0
}

export function updateStockBalance(productId: string, warehouseId: string, deltaQty: number): void {
  const balances = getStore<StockBalance[]>('stock_balances', [])
  const idx = balances.findIndex(b => b.product_id === productId && b.warehouse_id === warehouseId)
  if (idx >= 0) {
    balances[idx].quantity += deltaQty
    balances[idx].last_updated = new Date().toISOString()
  } else {
    balances.push({
      id: `bal-${productId}-${warehouseId}`,
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: deltaQty,
      last_updated: new Date().toISOString()
    })
  }
  setStore('stock_balances', balances)
}

// Daily Reports
export function getDailyReports(warehouseId?: string, createdBy?: string): DailyStockReport[] {
  const whs = getWarehouses()
  const prods = getProducts()
  let reports = getStore<DailyStockReport[]>('reports', EMPTY_REPORTS)

  if (warehouseId) {
    reports = reports.filter(r => r.warehouse_id === warehouseId)
  }
  if (createdBy) {
    reports = reports.filter(r => r.created_by === createdBy)
  }

  return reports.map(r => ({
    ...r,
    warehouse: whs.find(w => w.id === r.warehouse_id),
    lines: (r.lines || []).map(l => ({
      ...l,
      product: prods.find(p => p.id === l.product_id)
    }))
  })).sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
}

export function getDailyReportById(id: string): DailyStockReport | undefined {
  const reports = getDailyReports()
  return reports.find(r => r.id === id)
}

export function findDraftReport(date: string, warehouseId: string, createdBy: string): DailyStockReport | undefined {
  const reports = getDailyReports()
  return reports.find(r => r.report_date === date && r.warehouse_id === warehouseId && r.created_by === createdBy && r.status === 'draft')
}

export function saveDailyReport(report: DailyStockReport): DailyStockReport {
  const reports = getStore<DailyStockReport[]>('reports', EMPTY_REPORTS)
  const idx = reports.findIndex(r => r.id === report.id)
  const toSave = {
    ...report,
    id: report.id || `rep-${Date.now()}`,
    updated_at: new Date().toISOString()
  }

  if (idx >= 0) {
    reports[idx] = toSave
  } else {
    reports.unshift(toSave)
  }
  setStore('reports', reports)
  return toSave
}

export function submitDailyReport(reportId: string, actor: Profile): DailyStockReport {
  const reports = getStore<DailyStockReport[]>('reports', EMPTY_REPORTS)
  const idx = reports.findIndex(r => r.id === reportId)
  if (idx < 0) throw new Error('Report not found')

  const rep = reports[idx]
  rep.status = 'submitted'
  rep.submitted_at = new Date().toISOString()
  rep.updated_at = new Date().toISOString()
  reports[idx] = rep
  setStore('reports', reports)

  // Create approval request
  createApprovalRequest({
    reference_no: generateRef('APP-REP'),
    request_type: 'stock_report',
    entity_id: rep.id,
    created_by: actor.id,
    creator_name: actor.full_name,
    warehouse_id: rep.warehouse_id,
    summary: `Daily Stock Report (${rep.report_date}) — ${rep.lines?.length || 0} Products`,
    reason: rep.notes || 'Daily evening shift inventory submission',
    status: 'pending'
  })

  // Audit
  logAudit({
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action: 'SUBMIT_DAILY_REPORT',
    entity_type: 'DailyStockReport',
    entity_reference: rep.id,
    warehouse_name: getWarehouses().find(w => w.id === rep.warehouse_id)?.name,
    result: 'success',
    change_summary: `Submitted daily stock report with ${rep.lines?.length || 0} product lines`
  })

  return rep
}

export function approveDailyReport(reportId: string, reviewer: Profile, reviewNotes?: string): DailyStockReport {
  const reports = getStore<DailyStockReport[]>('reports', EMPTY_REPORTS)
  const idx = reports.findIndex(r => r.id === reportId)
  if (idx < 0) throw new Error('Report not found')

  const rep = reports[idx]
  if (rep.status === 'posted' || rep.status === 'approved') {
    throw new Error('Report already approved or posted')
  }

  rep.status = 'approved'
  rep.approved_by = reviewer.id
  rep.approved_at = new Date().toISOString()
  rep.updated_at = new Date().toISOString()

  // Atomically update stock balances and create movement ledger entries
  if (rep.lines && rep.lines.length > 0) {
    for (const line of rep.lines) {
      if (line.inward_qty > 0) {
        updateStockBalance(line.product_id, rep.warehouse_id, line.inward_qty)
        createMovementDirect({
          reference_no: generateRef('INW-REP'),
          movement_type: 'inward',
          product_id: line.product_id,
          warehouse_id: rep.warehouse_id,
          quantity: line.inward_qty,
          challan_no: `DAILY-${rep.report_date}`,
          notes: `Posted from daily stock report ${rep.report_date}`,
          created_by: rep.created_by,
          creator_name: rep.creator_name,
          status: 'posted',
          posted_at: new Date().toISOString()
        })
      }
      if (line.outward_qty > 0) {
        updateStockBalance(line.product_id, rep.warehouse_id, -line.outward_qty)
        createMovementDirect({
          reference_no: generateRef('OUT-REP'),
          movement_type: 'outward',
          product_id: line.product_id,
          warehouse_id: rep.warehouse_id,
          quantity: line.outward_qty,
          challan_no: `DAILY-${rep.report_date}`,
          notes: `Posted from daily stock report ${rep.report_date}`,
          created_by: rep.created_by,
          creator_name: rep.creator_name,
          status: 'posted',
          posted_at: new Date().toISOString()
        })
      }
    }
  }

  reports[idx] = rep
  setStore('reports', reports)

  // Update corresponding approval request if exists
  const approvals = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  const appIdx = approvals.findIndex(a => a.entity_id === reportId && a.status === 'pending')
  if (appIdx >= 0) {
    approvals[appIdx].status = 'approved'
    approvals[appIdx].reviewed_by = reviewer.id
    approvals[appIdx].reviewer_name = reviewer.full_name
    approvals[appIdx].reviewed_at = new Date().toISOString()
    approvals[appIdx].review_notes = reviewNotes || 'Approved'
    setStore('approvals', approvals)
  }

  logAudit({
    actor_id: reviewer.id,
    actor_name: reviewer.full_name,
    actor_role: reviewer.role,
    action: 'APPROVE_DAILY_REPORT',
    entity_type: 'DailyStockReport',
    entity_reference: rep.id,
    warehouse_name: getWarehouses().find(w => w.id === rep.warehouse_id)?.name,
    result: 'success',
    change_summary: `Approved daily stock report and posted ledger adjustments for ${rep.lines?.length || 0} products`
  })

  return rep
}

export function rejectDailyReport(reportId: string, reviewer: Profile, reason: string): DailyStockReport {
  const reports = getStore<DailyStockReport[]>('reports', EMPTY_REPORTS)
  const idx = reports.findIndex(r => r.id === reportId)
  if (idx < 0) throw new Error('Report not found')

  const rep = reports[idx]
  rep.status = 'rejected'
  rep.rejected_reason = reason
  rep.updated_at = new Date().toISOString()
  reports[idx] = rep
  setStore('reports', reports)

  // Update approval request
  const approvals = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  const appIdx = approvals.findIndex(a => a.entity_id === reportId && a.status === 'pending')
  if (appIdx >= 0) {
    approvals[appIdx].status = 'rejected'
    approvals[appIdx].reviewed_by = reviewer.id
    approvals[appIdx].reviewer_name = reviewer.full_name
    approvals[appIdx].reviewed_at = new Date().toISOString()
    approvals[appIdx].review_notes = reason
    setStore('approvals', approvals)
  }

  logAudit({
    actor_id: reviewer.id,
    actor_name: reviewer.full_name,
    actor_role: reviewer.role,
    action: 'REJECT_DAILY_REPORT',
    entity_type: 'DailyStockReport',
    entity_reference: rep.id,
    warehouse_name: getWarehouses().find(w => w.id === rep.warehouse_id)?.name,
    result: 'success',
    change_summary: `Rejected daily stock report: ${reason}`
  })

  return rep
}

// Movements
export function getMovements(filters?: { warehouseId?: string; productId?: string; movementType?: string }): StockMovement[] {
  const whs = getWarehouses()
  const prods = getProducts()
  let list = getStore<StockMovement[]>('movements', EMPTY_MOVEMENTS)

  if (filters?.warehouseId) list = list.filter(m => m.warehouse_id === filters.warehouseId)
  if (filters?.productId) list = list.filter(m => m.product_id === filters.productId)
  if (filters?.movementType) list = list.filter(m => m.movement_type === filters.movementType)

  return list.map(m => ({
    ...m,
    warehouse: whs.find(w => w.id === m.warehouse_id),
    dest_warehouse: whs.find(w => w.id === m.dest_warehouse_id),
    product: prods.find(p => p.id === m.product_id)
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function createMovementDirect(mov: Omit<StockMovement, 'id' | 'created_at'>): StockMovement {
  const list = getStore<StockMovement[]>('movements', EMPTY_MOVEMENTS)
  const newMov: StockMovement = {
    ...mov,
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    created_at: new Date().toISOString()
  }
  list.unshift(newMov)
  setStore('movements', list)
  return newMov
}

export function createMovement(mov: Omit<StockMovement, 'id' | 'created_at'>, actor: Profile): StockMovement {
  const newMov = createMovementDirect(mov)

  // If approved immediately or posted
  if (newMov.status === 'posted') {
    if (newMov.movement_type === 'inward' || newMov.movement_type === 'return') {
      updateStockBalance(newMov.product_id, newMov.warehouse_id, newMov.quantity)
    } else if (newMov.movement_type === 'outward') {
      updateStockBalance(newMov.product_id, newMov.warehouse_id, -newMov.quantity)
    } else if (newMov.movement_type === 'transfer_out' && newMov.dest_warehouse_id) {
      updateStockBalance(newMov.product_id, newMov.warehouse_id, -newMov.quantity)
      updateStockBalance(newMov.product_id, newMov.dest_warehouse_id, newMov.quantity)
    } else if (newMov.movement_type === 'adjustment') {
      // Set absolute quantity
      const balances = getStore<StockBalance[]>('stock_balances', [])
      const idx = balances.findIndex(b => b.product_id === newMov.product_id && b.warehouse_id === newMov.warehouse_id)
      if (idx >= 0) {
        balances[idx].quantity = newMov.quantity
        balances[idx].last_updated = new Date().toISOString()
      } else {
        balances.push({
          id: `bal-${newMov.product_id}-${newMov.warehouse_id}`,
          product_id: newMov.product_id,
          warehouse_id: newMov.warehouse_id,
          quantity: newMov.quantity,
          last_updated: new Date().toISOString()
        })
      }
      setStore('stock_balances', balances)
    }
  } else if (newMov.status === 'submitted') {
    // Requires approval
    createApprovalRequest({
      reference_no: generateRef('APP-MOV'),
      request_type: 'movement',
      entity_id: newMov.id,
      created_by: actor.id,
      creator_name: actor.full_name,
      warehouse_id: newMov.warehouse_id,
      summary: `${newMov.movement_type.toUpperCase()}: ${newMov.quantity} units (${newMov.reference_no})`,
      reason: newMov.notes || 'Manual stock movement recorded',
      status: 'pending'
    })
  }

  logAudit({
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action: `CREATE_${newMov.movement_type.toUpperCase()}`,
    entity_type: 'StockMovement',
    entity_reference: newMov.reference_no,
    warehouse_name: getWarehouses().find(w => w.id === newMov.warehouse_id)?.name,
    result: 'success',
    change_summary: `Created ${newMov.movement_type} movement for ${newMov.quantity} units (Status: ${newMov.status})`
  })

  return newMov
}

// Physical Counts
export function getPhysicalCounts(warehouseId?: string): PhysicalCount[] {
  const whs = getWarehouses()
  const prods = getProducts()
  let list = getStore<PhysicalCount[]>('physical_counts', EMPTY_PHYSICAL_COUNTS)

  if (warehouseId) list = list.filter(c => c.warehouse_id === warehouseId)

  return list.map(c => ({
    ...c,
    warehouse: whs.find(w => w.id === c.warehouse_id),
    lines: (c.lines || []).map(l => ({
      ...l,
      product: prods.find(p => p.id === l.product_id)
    }))
  })).sort((a, b) => new Date(b.count_date).getTime() - new Date(a.count_date).getTime())
}

export function getPhysicalCountById(idOrRef: string): PhysicalCount | undefined {
  const counts = getPhysicalCounts()
  return counts.find(c => c.id === idOrRef || c.reference_no === idOrRef)
}

export function getPhysicalCountDrafts(warehouseId?: string, createdBy?: string): PhysicalCount[] {
  const list = getStore<PhysicalCount[]>('physical_counts', EMPTY_PHYSICAL_COUNTS)
  const prods = getProducts()
  const whs = getWarehouses()

  return list
    .filter(c => {
      if (c.status !== 'draft') return false
      if (warehouseId && c.warehouse_id !== warehouseId) return false
      if (createdBy && c.created_by !== createdBy) return false
      return true
    })
    .map(c => ({
      ...c,
      warehouse: whs.find(w => w.id === c.warehouse_id),
      lines: (c.lines || []).map(l => ({
        ...l,
        product: prods.find(p => p.id === l.product_id)
      }))
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function deletePhysicalCountDraft(idOrRef: string): boolean {
  const list = getStore<PhysicalCount[]>('physical_counts', EMPTY_PHYSICAL_COUNTS)
  const idx = list.findIndex(c => (c.id === idOrRef || c.reference_no === idOrRef) && c.status === 'draft')
  if (idx >= 0) {
    list.splice(idx, 1)
    setStore('physical_counts', list)
    return true
  }
  return false
}

export interface StaffDraftItem {
  id: string
  reference: string
  type: 'inward' | 'outward' | 'manual'
  typeLabel: string
  title: string
  subtitle: string
  itemsCount: number
  date: string
  updatedAt: string
  route: string
}

export function getAllStaffDrafts(warehouseId?: string, createdBy?: string): StaffDraftItem[] {
  const inwardDrafts = getInwardDrafts(warehouseId, createdBy)
  const outwardDrafts = getDeliveryDrafts(warehouseId, createdBy)
  const countDrafts = getPhysicalCountDrafts(warehouseId, createdBy)

  const drafts: StaffDraftItem[] = []

  for (const inw of inwardDrafts) {
    const qtyTotal = inw.lines.reduce((s, l) => s + (l.quantity || 0), 0)
    drafts.push({
      id: inw.id,
      reference: inw.reference_no,
      type: 'inward',
      typeLabel: 'Inward Stock Receipt',
      title: inw.supplier_name || 'Factory Inward Receipt',
      subtitle: `Challan: ${inw.challan_no || '—'} • ${inw.lines.length} items (${qtyTotal} units)`,
      itemsCount: inw.lines.length,
      date: inw.entry_date,
      updatedAt: inw.updated_at || inw.created_at,
      route: `/staff/inward?draftId=${encodeURIComponent(inw.reference_no)}`
    })
  }

  for (const out of outwardDrafts) {
    const qtyTotal = out.items.reduce((s, i) => s + (i.quantity || 0), 0)
    drafts.push({
      id: out.id,
      reference: out.delivery_ref,
      type: 'outward',
      typeLabel: 'Outward Delivery',
      title: out.customer_name ? `${out.customer_name} (${out.city || 'Local'})` : 'Customer Dispatch',
      subtitle: `Vehicle: ${out.vehicle_registration_number || '—'} • ${out.items.length} items (${qtyTotal} units)`,
      itemsCount: out.items.length,
      date: out.date,
      updatedAt: out.updated_at || out.created_at,
      route: `/staff/outward?draftId=${encodeURIComponent(out.delivery_ref)}`
    })
  }

  for (const pc of countDrafts) {
    drafts.push({
      id: pc.id,
      reference: pc.reference_no,
      type: 'manual',
      typeLabel: 'Manual Count / Adjustment',
      title: `Physical Verification (${pc.reference_no})`,
      subtitle: `${pc.lines?.length || 0} products verified • ${pc.notes || 'Draft count'}`,
      itemsCount: pc.lines?.length || 0,
      date: pc.count_date,
      updatedAt: pc.created_at,
      route: `/staff/manual-entry?draftId=${encodeURIComponent(pc.reference_no)}`
    })
  }

  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function savePhysicalCount(count: PhysicalCount, actor: Profile): PhysicalCount {
  const list = getStore<PhysicalCount[]>('physical_counts', EMPTY_PHYSICAL_COUNTS)
  const idx = list.findIndex(c => (c.id && c.id === count.id) || (c.reference_no && c.reference_no === count.reference_no))

  const existing = idx >= 0 ? list[idx] : null

  // If already posted/completed, prevent duplicate stock updates
  if (existing && (existing.status === 'completed' || existing.status === 'approved' || existing.status === 'posted')) {
    return existing
  }

  const isSubmitting = count.status === 'submitted' || count.status === 'completed'

  const toSave: PhysicalCount = {
    ...count,
    id: count.id || `pc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    status: isSubmitting ? 'completed' : 'draft',
    created_at: count.created_at || new Date().toISOString()
  }

  // If submitting, adjust stock directly without approval workflow
  if (isSubmitting) {
    const balances = getStore<StockBalance[]>('stock_balances', [])

    if (toSave.lines) {
      for (const line of toSave.lines) {
        if (line.variance !== 0) {
          const bIdx = balances.findIndex(b => b.product_id === line.product_id && b.warehouse_id === toSave.warehouse_id)
          if (bIdx >= 0) {
            balances[bIdx].quantity = line.counted_stock
            balances[bIdx].last_updated = new Date().toISOString()
          } else {
            balances.push({
              id: `sb-${line.product_id}-${toSave.warehouse_id}`,
              product_id: line.product_id,
              warehouse_id: toSave.warehouse_id,
              quantity: line.counted_stock,
              last_updated: new Date().toISOString()
            })
          }

          // Create ledger movement record
          createMovementDirect({
            reference_no: toSave.reference_no,
            movement_type: 'adjustment',
            product_id: line.product_id,
            warehouse_id: toSave.warehouse_id,
            quantity: Math.abs(line.variance),
            challan_no: toSave.reference_no,
            notes: `Manual stock verification adjustment (${line.variance > 0 ? '+' : ''}${line.variance}). Counted: ${line.counted_stock}, Previous System: ${line.system_stock}`,
            created_by: actor.id,
            creator_name: actor.full_name,
            status: 'posted',
            posted_at: new Date().toISOString()
          })
        }
      }
      setStore('stock_balances', balances)
    }
  }

  if (idx >= 0) {
    list[idx] = toSave
  } else {
    list.unshift(toSave)
  }
  setStore('physical_counts', list)

  logAudit({
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action: isSubmitting ? 'SUBMIT_PHYSICAL_COUNT' : 'SAVE_PHYSICAL_COUNT_DRAFT',
    entity_type: 'PhysicalCount',
    entity_reference: toSave.reference_no,
    warehouse_name: getWarehouses().find(w => w.id === toSave.warehouse_id)?.name,
    result: 'success',
    change_summary: `${isSubmitting ? 'Completed manual stock adjustment' : 'Saved draft verification'} with ${(toSave.lines || []).length} items. (Status: ${toSave.status})`
  })

  return toSave
}

export function approvePhysicalCountAdjustment(countId: string, reviewer: Profile): void {
  const counts = getStore<PhysicalCount[]>('physical_counts', EMPTY_PHYSICAL_COUNTS)
  const count = counts.find(c => c.id === countId)
  if (!count) throw new Error('Count not found')

  count.status = 'approved'
  if (count.lines) {
    for (const line of count.lines) {
      if (line.variance !== 0) {
        // Adjust stock balance to match counted_stock
        const balances = getStore<StockBalance[]>('stock_balances', [])
        const idx = balances.findIndex(b => b.product_id === line.product_id && b.warehouse_id === count.warehouse_id)
        if (idx >= 0) {
          balances[idx].quantity = line.counted_stock
          balances[idx].last_updated = new Date().toISOString()
        }
        setStore('stock_balances', balances)

        // Post adjustment movement
        createMovementDirect({
          reference_no: generateRef('ADJ-PC'),
          movement_type: 'adjustment',
          product_id: line.product_id,
          warehouse_id: count.warehouse_id,
          quantity: line.counted_stock,
          challan_no: count.reference_no,
          notes: `Reconciliation adjustment (Variance was: ${line.variance})`,
          created_by: reviewer.id,
          creator_name: reviewer.full_name,
          status: 'posted',
          posted_at: new Date().toISOString()
        })
      }
      line.status = 'approved'
    }
  }
  setStore('physical_counts', counts)

  // Update approval
  const approvals = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  const appIdx = approvals.findIndex(a => a.entity_id === countId && a.status === 'pending')
  if (appIdx >= 0) {
    approvals[appIdx].status = 'approved'
    approvals[appIdx].reviewed_by = reviewer.id
    approvals[appIdx].reviewer_name = reviewer.full_name
    approvals[appIdx].reviewed_at = new Date().toISOString()
    approvals[appIdx].review_notes = 'Reconciled balances adjusted'
    setStore('approvals', approvals)
  }

  logAudit({
    actor_id: reviewer.id,
    actor_name: reviewer.full_name,
    actor_role: reviewer.role,
    action: 'APPROVE_PHYSICAL_COUNT',
    entity_type: 'PhysicalCount',
    entity_reference: count.reference_no,
    warehouse_name: getWarehouses().find(w => w.id === count.warehouse_id)?.name,
    result: 'success',
    change_summary: `Approved physical count and reconciled ${(count.lines || []).filter(l => l.variance !== 0).length} inventory discrepancies`
  })
}

// Approvals
export function getApprovalRequests(status?: string): ApprovalRequest[] {
  const whs = getWarehouses()
  let list = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  if (status) list = list.filter(a => a.status === status)

  return list.map(a => ({
    ...a,
    warehouse: whs.find(w => w.id === a.warehouse_id)
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function createApprovalRequest(req: Omit<ApprovalRequest, 'id' | 'created_at'>): ApprovalRequest {
  const list = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  const newReq: ApprovalRequest = {
    ...req,
    id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    created_at: new Date().toISOString()
  }
  list.unshift(newReq)
  setStore('approvals', list)
  return newReq
}

export function actionApproval(
  approvalId: string,
  action: 'approve' | 'reject' | 'correction_requested',
  reviewer: Profile,
  notes?: string
): void {
  const list = getStore<ApprovalRequest[]>('approvals', EMPTY_APPROVALS)
  const req = list.find(a => a.id === approvalId)
  if (!req) throw new Error('Approval request not found')

  if (action === 'approve') {
    if (req.request_type === 'stock_report') {
      approveDailyReport(req.entity_id, reviewer, notes)
    } else if (req.request_type === 'physical_count') {
      approvePhysicalCountAdjustment(req.entity_id, reviewer)
    } else if (req.request_type === 'movement') {
      const movements = getStore<StockMovement[]>('movements', EMPTY_MOVEMENTS)
      const mov = movements.find(m => m.id === req.entity_id)
      if (mov) {
        mov.status = 'posted'
        mov.posted_at = new Date().toISOString()
        setStore('movements', movements)
        if (mov.movement_type === 'inward' || mov.movement_type === 'return') {
          updateStockBalance(mov.product_id, mov.warehouse_id, mov.quantity)
        } else if (mov.movement_type === 'outward') {
          updateStockBalance(mov.product_id, mov.warehouse_id, -mov.quantity)
        } else if (mov.movement_type === 'transfer_out' && mov.dest_warehouse_id) {
          updateStockBalance(mov.product_id, mov.warehouse_id, -mov.quantity)
          updateStockBalance(mov.product_id, mov.dest_warehouse_id, mov.quantity)
        }
      }
    }
    req.status = 'approved'
  } else if (action === 'reject') {
    if (req.request_type === 'stock_report') {
      rejectDailyReport(req.entity_id, reviewer, notes || 'Rejected by reviewer')
    }
    req.status = 'rejected'
  } else {
    req.status = 'correction_requested'
  }

  req.reviewed_by = reviewer.id
  req.reviewer_name = reviewer.full_name
  req.reviewed_at = new Date().toISOString()
  req.review_notes = notes || ''
  setStore('approvals', list)
}

// Rates & Discounts
export function getPriceRules(): PriceRule[] {
  const prods = getProducts()
  const cats = getCategories()
  const list = getStore<PriceRule[]>('price_rules', EMPTY_PRICE_RULES)
  return list.map(r => ({
    ...r,
    product: prods.find(p => p.id === r.product_id),
    category: cats.find(c => c.id === r.category_id)
  }))
}

export function savePriceRule(rule: PriceRule): PriceRule {
  const list = getStore<PriceRule[]>('price_rules', EMPTY_PRICE_RULES)
  const idx = list.findIndex(r => r.id === rule.id)
  if (idx >= 0) {
    list[idx] = rule
  } else {
    list.push({ ...rule, id: rule.id || `pr-${Date.now()}`, created_at: new Date().toISOString() })
  }
  setStore('price_rules', list)
  return rule
}

export function deletePriceRule(id: string): void {
  const list = getStore<PriceRule[]>('price_rules', EMPTY_PRICE_RULES).filter(r => r.id !== id)
  setStore('price_rules', list)
}

// Audit Logs
export function getAuditLogs(): AuditLog[] {
  return getStore<AuditLog[]>('audit_logs', EMPTY_AUDIT_LOGS).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function logAudit(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
  const list = getStore<AuditLog[]>('audit_logs', EMPTY_AUDIT_LOGS)
  const newEntry: AuditLog = {
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: new Date().toISOString()
  }
  list.unshift(newEntry)
  setStore('audit_logs', list.slice(0, 500)) // Keep recent 500
}

// ==================== VEHICLES REPOSITORY ====================

export function getVehicles(onlyActive = false): Vehicle[] {
  const list = getStore<Vehicle[]>('vehicles', EMPTY_VEHICLES)
  if (onlyActive) {
    return list.filter(v => v.is_active)
  }
  return [...list]
}

export function getVehicleById(id: string): Vehicle | undefined {
  const list = getVehicles()
  return list.find(v => v.id === id)
}

export function saveVehicle(data: Partial<Vehicle>): Vehicle {
  const list = getStore<Vehicle[]>('vehicles', EMPTY_VEHICLES)
  const regNumber = (data.registration_number || '').trim().toUpperCase()

  // Validate duplicate registration number
  const existingWithReg = list.find(v => v.registration_number.toUpperCase() === regNumber && v.id !== data.id)
  if (existingWithReg) {
    throw new Error(`Vehicle with registration number "${regNumber}" already exists (${existingWithReg.name}).`)
  }

  let savedVehicle: Vehicle
  if (data.id) {
    const idx = list.findIndex(v => v.id === data.id)
    if (idx === -1) throw new Error('Vehicle not found')
    savedVehicle = {
      ...list[idx],
      ...data,
      registration_number: regNumber,
      updated_at: new Date().toISOString()
    }
    list[idx] = savedVehicle
  } else {
    savedVehicle = {
      id: `veh-${Date.now()}`,
      name: data.name || 'Commercial Vehicle',
      registration_number: regNumber,
      vehicle_type: data.vehicle_type || 'Truck',
      insurance_policy_no: data.insurance_policy_no || null,
      insurance_expiry_date: data.insurance_expiry_date || null,
      puc_certificate_no: data.puc_certificate_no || null,
      puc_expiry_date: data.puc_expiry_date || null,
      owner_name: data.owner_name || null,
      contact_number: data.contact_number || null,
      notes: data.notes || null,
      is_active: data.is_active !== undefined ? data.is_active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    list.push(savedVehicle)
  }

  setStore('vehicles', list)
  return savedVehicle
}

export function toggleVehicleActive(id: string): Vehicle {
  const list = getStore<Vehicle[]>('vehicles', EMPTY_VEHICLES)
  const idx = list.findIndex(v => v.id === id)
  if (idx === -1) throw new Error('Vehicle not found')
  list[idx].is_active = !list[idx].is_active
  list[idx].updated_at = new Date().toISOString()
  setStore('vehicles', list)
  return list[idx]
}

export function getVehicleDeliveries(registrationNumber: string): OutwardDelivery[] {
  const allDeliveries = getDeliveries()
  const cleanReg = registrationNumber.trim().toUpperCase()
  return allDeliveries.filter(d => (d.vehicle_registration_number || '').toUpperCase() === cleanReg)
}

// ==================== EMPLOYEES & DRIVERS REPOSITORY ====================

export function getAllEmployees(): Profile[] {
  return getStore<Profile[]>('profiles', EMPTY_PROFILES)
}

export function getDrivers(onlyActive = true): Profile[] {
  const all = getAllEmployees()
  return all.filter(e => e.role === 'driver' && (!onlyActive || e.is_active))
}

export function toggleEmployeeActive(id: string): Profile {
  const list = getStore<Profile[]>('profiles', EMPTY_PROFILES)
  const idx = list.findIndex(p => p.id === id)
  if (idx === -1) throw new Error('Employee not found')
  list[idx].is_active = !list[idx].is_active
  list[idx].updated_at = new Date().toISOString()
  setStore('profiles', list)
  return list[idx]
}

// ==================== OUTWARD DELIVERIES REPOSITORY ====================

export function getDeliveries(filter?: {
  warehouseId?: string
  search?: string
  status?: DeliveryStatus
  vehicleReg?: string
  driverName?: string
}): OutwardDelivery[] {
  const list = getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)
  const products = getProducts()
  const warehouses = getWarehouses()

  let res = list.map(d => ({
    ...d,
    warehouse: warehouses.find(w => w.id === d.warehouse_id),
    items: d.items.map(it => ({
      ...it,
      product: products.find(p => p.id === it.product_id)
    }))
  }))

  if (filter?.warehouseId) {
    res = res.filter(d => d.warehouse_id === filter.warehouseId)
  }
  if (filter?.status) {
    res = res.filter(d => d.status === filter.status)
  }
  if (filter?.vehicleReg) {
    const vr = filter.vehicleReg.trim().toUpperCase()
    res = res.filter(d => (d.vehicle_registration_number || '').toUpperCase().includes(vr))
  }
  if (filter?.driverName) {
    const dn = filter.driverName.trim().toLowerCase()
    res = res.filter(d => (d.driver_name || '').toLowerCase().includes(dn))
  }
  if (filter?.search) {
    const q = filter.search.trim().toLowerCase()
    res = res.filter(d =>
      d.delivery_ref.toLowerCase().includes(q) ||
      d.do_number.toLowerCase().includes(q) ||
      d.memo_number.toLowerCase().includes(q) ||
      d.customer_name.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.vehicle_registration_number.toLowerCase().includes(q) ||
      d.driver_name.toLowerCase().includes(q)
    )
  }

  // Sort newest first
  return res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getDeliveryById(id: string): OutwardDelivery | undefined {
  const deliveries = getDeliveries()
  return deliveries.find(d => d.id === id || d.delivery_ref === id)
}

export function getDeliveryDrafts(warehouseId?: string, createdBy?: string): OutwardDelivery[] {
  const deliveries = getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)
  return deliveries.filter(d => {
    if (d.status !== 'draft') return false
    if (warehouseId && d.warehouse_id !== warehouseId) return false
    if (createdBy && d.created_by !== createdBy) return false
    return true
  }).sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
}

export function deleteDeliveryDraft(idOrRef: string): boolean {
  const list = getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)
  const idx = list.findIndex(d => (d.id === idOrRef || d.delivery_ref === idOrRef) && d.status === 'draft')
  if (idx >= 0) {
    list.splice(idx, 1)
    setStore('deliveries', list)
    return true
  }
  return false
}

export function saveOutwardDelivery(
  deliveryData: Omit<OutwardDelivery, 'id' | 'created_at'>,
  actor: Profile
): OutwardDelivery {
  const list = getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)

  // Check if delivery already exists (e.g. updating draft or completing draft)
  const existingIdx = list.findIndex(d => d.delivery_ref === deliveryData.delivery_ref)

  if (existingIdx >= 0) {
    const existing = list[existingIdx]

    // Case 1: Was draft, now transitioning to 'awaiting_return' (Submitting Draft)
    if (existing.status === 'draft' && deliveryData.status === 'awaiting_return') {
      const activeItems = deliveryData.items.filter(it => it.quantity > 0)
      for (const item of activeItems) {
        const currentBal = getProductStockBalance(item.product_id, deliveryData.warehouse_id)
        if (item.quantity > currentBal) {
          const prod = getProductById(item.product_id)
          throw new Error(
            `Insufficient stock for "${prod?.name || item.product_id}". Required: ${item.quantity}, Current Available in Godown: ${currentBal}.`
          )
        }
      }

      // Deduct stock exactly once and record ledger movements
      for (const item of activeItems) {
        updateStockBalance(item.product_id, deliveryData.warehouse_id, -item.quantity)
        createMovementDirect({
          reference_no: deliveryData.delivery_ref,
          movement_type: 'outward',
          product_id: item.product_id,
          warehouse_id: deliveryData.warehouse_id,
          quantity: item.quantity,
          challan_no: deliveryData.do_number || deliveryData.memo_number,
          supplier_customer: `${deliveryData.customer_name} (${deliveryData.city})`,
          notes: `Outward Delivery ${deliveryData.delivery_ref} | Veh: ${deliveryData.vehicle_registration_number} | Driver: ${deliveryData.driver_name}`,
          created_by: actor.id,
          creator_name: actor.full_name,
          status: 'posted',
          posted_at: new Date().toISOString()
        })
      }

      const updated: OutwardDelivery = {
        ...existing,
        ...deliveryData,
        status: 'awaiting_return',
        dispatch_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      list[existingIdx] = updated
      setStore('deliveries', list)

      logAudit({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: 'SUBMIT_OUTWARD_DELIVERY',
        entity_type: 'DELIVERY',
        entity_reference: updated.delivery_ref,
        warehouse_name: deliveryData.warehouse_id,
        result: 'success',
        change_summary: `Submitted draft delivery ${updated.delivery_ref} for ${updated.customer_name}. Stock deducted immediately.`
      })

      return updated
    }

    // Case 2: Updating an existing draft (still in draft status)
    if (existing.status === 'draft' && deliveryData.status === 'draft') {
      const updated: OutwardDelivery = {
        ...existing,
        ...deliveryData,
        status: 'draft',
        updated_at: new Date().toISOString()
      }

      list[existingIdx] = updated
      setStore('deliveries', list)

      logAudit({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: 'UPDATE_DELIVERY_DRAFT',
        entity_type: 'DELIVERY',
        entity_reference: updated.delivery_ref,
        warehouse_name: deliveryData.warehouse_id,
        result: 'success',
        change_summary: `Updated outward delivery draft ${updated.delivery_ref}.`
      })

      return updated
    }

    // Case 3: Already active or completed - prevent duplicate stock deduction
    return existing
  }

  // Brand New Delivery (not in store yet)
  if (deliveryData.status === 'awaiting_return') {
    const activeItems = deliveryData.items.filter(it => it.quantity > 0)
    for (const item of activeItems) {
      const currentBal = getProductStockBalance(item.product_id, deliveryData.warehouse_id)
      if (item.quantity > currentBal) {
        const prod = getProductById(item.product_id)
        throw new Error(
          `Insufficient stock for "${prod?.name || item.product_id}". Required: ${item.quantity}, Current Available in Godown: ${currentBal}.`
        )
      }
    }

    // Deduct stock immediately and record ledger movements
    for (const item of activeItems) {
      updateStockBalance(item.product_id, deliveryData.warehouse_id, -item.quantity)
      createMovementDirect({
        reference_no: deliveryData.delivery_ref,
        movement_type: 'outward',
        product_id: item.product_id,
        warehouse_id: deliveryData.warehouse_id,
        quantity: item.quantity,
        challan_no: deliveryData.do_number || deliveryData.memo_number,
        supplier_customer: `${deliveryData.customer_name} (${deliveryData.city})`,
        notes: `Outward Delivery ${deliveryData.delivery_ref} | Veh: ${deliveryData.vehicle_registration_number} | Driver: ${deliveryData.driver_name}`,
        created_by: actor.id,
        creator_name: actor.full_name,
        status: 'posted',
        posted_at: new Date().toISOString()
      })
    }
  }

  const newDelivery: OutwardDelivery = {
    ...deliveryData,
    id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  list.unshift(newDelivery)
  setStore('deliveries', list)

  logAudit({
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action: deliveryData.status === 'draft' ? 'SAVE_DELIVERY_DRAFT' : 'CREATE_OUTWARD_DELIVERY',
    entity_type: 'DELIVERY',
    entity_reference: newDelivery.delivery_ref,
    warehouse_name: deliveryData.warehouse_id,
    result: 'success',
    change_summary: `${deliveryData.status === 'draft' ? 'Saved draft' : 'Created'} delivery ${newDelivery.delivery_ref} for ${newDelivery.customer_name} (${newDelivery.city}) with ${newDelivery.items.filter(i => i.quantity > 0).length} items. Status: ${newDelivery.status}`
  })

  return newDelivery
}

export async function updateDeliveryReturnKM(
  deliveryId: string,
  inKm: number,
  returnNotes?: string,
  actor?: Profile
): Promise<OutwardDelivery> {
  if (actor && (actor.role === 'admin' || actor.role === 'manager')) {
    throw new Error(
      'Vehicle IN KM must not be entered or edited by Admin or Manager. Only Godown Staff can record return odometer readings upon vehicle return.'
    )
  }

  if (!Number.isFinite(inKm) || inKm < 0) {
    throw new Error('Please enter a valid, non-negative Vehicle IN KM reading.')
  }

  const supabase = getSupabase()

  // Read the authoritative database row first; localStorage can be stale or
  // belong to a different browser/device.
  let deliveryResult = await supabase
    .from('outward_deliveries')
    .select('*')
    .eq('id', deliveryId)
    .maybeSingle()

  if (deliveryResult.error) {
    throw new Error(`Unable to load delivery before saving return KM: ${deliveryResult.error.message}`)
  }

  if (!deliveryResult.data) {
    deliveryResult = await supabase
      .from('outward_deliveries')
      .select('*')
      .eq('delivery_ref', deliveryId)
      .maybeSingle()

    if (deliveryResult.error) {
      throw new Error(`Unable to find delivery before saving return KM: ${deliveryResult.error.message}`)
    }
  }

  const deliveryRow = deliveryResult.data
  if (!deliveryRow) {
    throw new Error('Delivery record not found in the shared database. Refresh the page and try again.')
  }

  const outKm = Number(deliveryRow.vehicle_out_km)
  if (!Number.isFinite(outKm) || outKm < 0) {
    throw new Error('The saved Vehicle OUT KM is invalid. Correct the dispatch record before recording return KM.')
  }
  if (inKm < outKm) {
    throw new Error(`Vehicle In KM (${inKm}) cannot be less than Vehicle Out KM (${outKm}).`)
  }
  if (deliveryRow.status === 'draft') {
    throw new Error('A draft delivery cannot be marked returned. Submit the delivery first.')
  }

  const now = new Date().toISOString()
  const distance = inKm - outKm
  const updatePayload = {
    vehicle_in_km: inKm,
    distance_travelled: distance,
    return_timestamp: now,
    return_notes: returnNotes !== undefined ? (returnNotes.trim() || null) : (deliveryRow.return_notes ?? null),
    return_updated_by: actor?.full_name || 'Godown Staff',
    status: 'completed',
    updated_at: now
  }

  const updateResult = await supabase
    .from('outward_deliveries')
    .update(updatePayload)
    .eq('id', deliveryRow.id)
    .select('*')
    .single()

  if (updateResult.error) {
    throw new Error(`Vehicle return was not saved to the shared database: ${updateResult.error.message}`)
  }

  if (!updateResult.data || updateResult.data.vehicle_in_km == null ||
      Number(updateResult.data.vehicle_in_km) !== inKm ||
      updateResult.data.status !== 'completed') {
    throw new Error('The database did not confirm the Vehicle IN KM and completed status. Please refresh and verify before retrying.')
  }

  const updatedRow = updateResult.data
  const updated: OutwardDelivery = {
    ...(deliveryRow as OutwardDelivery),
    ...updatedRow,
    date: updatedRow.delivery_date ?? (deliveryRow as any).date,
    dispatch_timestamp: updatedRow.dispatch_timestamp ?? updatedRow.created_at,
    vehicle_out_km: Number(updatedRow.vehicle_out_km) || 0,
    vehicle_in_km: updatedRow.vehicle_in_km == null ? null : Number(updatedRow.vehicle_in_km),
    distance_travelled: updatedRow.distance_travelled == null ? null : Number(updatedRow.distance_travelled),
    items: (getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)
      .find(d => d.id === updatedRow.id)?.items ?? [])
  } as OutwardDelivery

  // Refresh the browser cache only after the database confirms the update.
  const list = getStore<OutwardDelivery[]>('deliveries', EMPTY_DELIVERIES)
  const idx = list.findIndex(d => d.id === updated.id || d.delivery_ref === updated.delivery_ref)
  if (idx >= 0) list[idx] = { ...list[idx], ...updated }
  else list.unshift(updated)
  setStore('deliveries', list)

  logAudit({
    actor_id: actor?.id || 'usr-3',
    actor_name: actor?.full_name || 'Godown Staff',
    actor_role: actor?.role || 'staff',
    action: 'UPDATE_DELIVERY_RETURN_KM',
    entity_type: 'DELIVERY',
    entity_reference: updated.delivery_ref,
    result: 'success',
    change_summary: `Logged Vehicle In KM ${inKm} for delivery ${updated.delivery_ref}. Distance travelled: ${distance} km.`
  })

  return updated
}

/**
 * Reload outward deliveries from the shared database and update the local
 * compatibility cache used by synchronous screens.
 */
export async function refreshDeliveriesFromSupabase(): Promise<void> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('outward_deliveries')
    .select('*, items:delivery_items(*)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to refresh deliveries from the shared database: ${error.message}`)
  }

  setStore('deliveries', (data ?? []).map((row: any) => ({
    ...row,
    date: row.delivery_date ?? row.date,
    dispatch_timestamp: row.dispatch_timestamp ?? row.created_at,
    vehicle_out_km: Number(row.vehicle_out_km) || 0,
    vehicle_in_km: row.vehicle_in_km == null ? null : Number(row.vehicle_in_km),
    distance_travelled: row.distance_travelled == null ? null : Number(row.distance_travelled),
    items: (row.items ?? []).map((item: any) => ({
      ...item,
      delivery_id: row.id,
      quantity: Number(item.quantity) || 0
    }))
  })))
}

// ==================== INWARD STOCK ENTRIES REPOSITORY ====================

export function getInwardEntries(warehouseId?: string): InwardStockEntry[] {
  const list = getStore<InwardStockEntry[]>('inward_entries', EMPTY_INWARD_ENTRIES)
  const products = getProducts()
  const warehouses = getWarehouses()

  let res = list.map(entry => ({
    ...entry,
    warehouse: warehouses.find(w => w.id === entry.warehouse_id),
    lines: entry.lines.map(line => ({
      ...line,
      product: products.find(p => p.id === line.product_id)
    }))
  }))

  if (warehouseId) {
    res = res.filter(e => e.warehouse_id === warehouseId)
  }

  return res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function getInwardEntryById(idOrRef: string): InwardStockEntry | undefined {
  const entries = getInwardEntries()
  return entries.find(e => e.id === idOrRef || e.reference_no === idOrRef)
}

export function getInwardDrafts(warehouseId?: string, createdBy?: string): InwardStockEntry[] {
  const list = getStore<InwardStockEntry[]>('inward_entries', EMPTY_INWARD_ENTRIES)
  const products = getProducts()
  const warehouses = getWarehouses()

  return list
    .filter(e => {
      if (e.status !== 'draft') return false
      if (warehouseId && e.warehouse_id !== warehouseId) return false
      if (createdBy && e.created_by !== createdBy) return false
      return true
    })
    .map(entry => ({
      ...entry,
      warehouse: warehouses.find(w => w.id === entry.warehouse_id),
      lines: entry.lines.map(line => ({
        ...line,
        product: products.find(p => p.id === line.product_id)
      }))
    }))
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
}

export function deleteInwardDraft(idOrRef: string): boolean {
  const list = getStore<InwardStockEntry[]>('inward_entries', EMPTY_INWARD_ENTRIES)
  const idx = list.findIndex(e => (e.id === idOrRef || e.reference_no === idOrRef) && e.status === 'draft')
  if (idx >= 0) {
    list.splice(idx, 1)
    setStore('inward_entries', list)
    return true
  }
  return false
}

export function saveInwardEntry(
  entryData: Omit<InwardStockEntry, 'id' | 'created_at'>,
  actor: Profile
): InwardStockEntry {
  const list = getStore<InwardStockEntry[]>('inward_entries', EMPTY_INWARD_ENTRIES)

  // Check if existing entry exists (updating draft or submitting draft)
  const existingIdx = list.findIndex(e => e.reference_no === entryData.reference_no)

  if (existingIdx >= 0) {
    const existing = list[existingIdx]

    // Case 1: Was draft, now submitting as 'saved' (Submitting Draft)
    if (existing.status === 'draft' && entryData.status === 'saved') {
      const activeLines = entryData.lines.filter(l => l.quantity > 0)
      for (const line of activeLines) {
        updateStockBalance(line.product_id, entryData.warehouse_id, line.quantity)
        createMovementDirect({
          reference_no: entryData.reference_no,
          movement_type: 'inward',
          product_id: line.product_id,
          warehouse_id: entryData.warehouse_id,
          quantity: line.quantity,
          challan_no: entryData.challan_no,
          supplier_customer: entryData.supplier_name,
          notes: entryData.notes || `Inward goods entry ${entryData.reference_no}`,
          created_by: actor.id,
          creator_name: actor.full_name,
          status: 'posted',
          posted_at: new Date().toISOString()
        })
      }

      const updated: InwardStockLine[] = entryData.lines
      const updatedEntry: InwardStockEntry = {
        ...existing,
        ...entryData,
        lines: updated,
        status: 'saved',
        updated_at: new Date().toISOString()
      }

      list[existingIdx] = updatedEntry
      setStore('inward_entries', list)

      logAudit({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: 'SUBMIT_INWARD_ENTRY',
        entity_type: 'INWARD_ENTRY',
        entity_reference: updatedEntry.reference_no,
        warehouse_name: entryData.warehouse_id,
        result: 'success',
        change_summary: `Submitted draft inward entry ${updatedEntry.reference_no} from ${updatedEntry.supplier_name}. Stock increased immediately.`
      })

      return updatedEntry
    }

    // Case 2: Updating an existing draft (still in draft status)
    if (existing.status === 'draft' && entryData.status === 'draft') {
      const updatedEntry: InwardStockEntry = {
        ...existing,
        ...entryData,
        status: 'draft',
        updated_at: new Date().toISOString()
      }

      list[existingIdx] = updatedEntry
      setStore('inward_entries', list)

      logAudit({
        actor_id: actor.id,
        actor_name: actor.full_name,
        actor_role: actor.role,
        action: 'UPDATE_INWARD_DRAFT',
        entity_type: 'INWARD_ENTRY',
        entity_reference: updatedEntry.reference_no,
        warehouse_name: entryData.warehouse_id,
        result: 'success',
        change_summary: `Updated inward entry draft ${updatedEntry.reference_no}.`
      })

      return updatedEntry
    }

    // Case 3: Already saved - prevent duplicate stock increase
    return existing
  }

  // Brand new inward entry
  if (entryData.status === 'saved') {
    const activeLines = entryData.lines.filter(l => l.quantity > 0)
    for (const line of activeLines) {
      updateStockBalance(line.product_id, entryData.warehouse_id, line.quantity)
      createMovementDirect({
        reference_no: entryData.reference_no,
        movement_type: 'inward',
        product_id: line.product_id,
        warehouse_id: entryData.warehouse_id,
        quantity: line.quantity,
        challan_no: entryData.challan_no,
        supplier_customer: entryData.supplier_name,
        notes: entryData.notes || `Inward goods entry ${entryData.reference_no}`,
        created_by: actor.id,
        creator_name: actor.full_name,
        status: 'posted',
        posted_at: new Date().toISOString()
      })
    }
  }

  const newEntry: InwardStockEntry = {
    ...entryData,
    id: `inw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  list.unshift(newEntry)
  setStore('inward_entries', list)

  logAudit({
    actor_id: actor.id,
    actor_name: actor.full_name,
    actor_role: actor.role,
    action: entryData.status === 'draft' ? 'SAVE_INWARD_DRAFT' : 'CREATE_INWARD_ENTRY',
    entity_type: 'INWARD_ENTRY',
    entity_reference: newEntry.reference_no,
    warehouse_name: entryData.warehouse_id,
    result: 'success',
    change_summary: `${entryData.status === 'draft' ? 'Saved draft' : 'Recorded'} inward entry ${newEntry.reference_no} from ${newEntry.supplier_name} (${newEntry.challan_no}) with ${newEntry.lines.filter(l => l.quantity > 0).length} items. Status: ${newEntry.status}`
  })

  return newEntry
}

// ==================== CSV PRODUCT IMPORT SERVICE ====================

export function importProductsFromCSV(
  rows: any[],
  duplicateStrategy: 'update' | 'skip' = 'update',
  actor?: Profile
): {
  total_processed: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { row: number; sku?: string; error: string }[]
} {
  const currentProducts = getStore<Product[]>('products', EMPTY_PRODUCTS)
  const categories = getCategories()
  const warehouses = getWarehouses()

  const result = {
    total_processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { row: number; sku?: string; error: string }[]
  }

  const updatedProductsList = [...currentProducts]

  rows.forEach((rawRow, idx) => {
    const rowNum = idx + 1
    result.total_processed++

    // Normalize keys to lowercase for flexible matching
    const row: Record<string, any> = {}
    for (const [k, v] of Object.entries(rawRow)) {
      if (typeof k === 'string') {
        row[k.trim().toLowerCase().replace(/[\s_-]+/g, '')] = typeof v === 'string' ? v.trim() : v
      }
    }

    // Extract fields with fallbacks
    const skuRaw = row.sku || row.itemcode || row.productsku || row.partnumber || row.id
    const nameRaw = row.name || row.productname || row.itemname || row.description
    const categoryRaw = row.category || row.categoryname || row.cat || row.group
    const unitRaw = row.unit || row.uom || 'piece'
    const rateRaw = row.rateinr || row.rate || row.price || row.unitprice || row.mrp || 0
    const gstRaw = row.gstpercent || row.gst || row.tax || 18
    const gradeRaw = row.grade || row.class || row.type || null
    const diameterRaw = row.diametermm || row.diameter || row.size || row.dia || null
    const pressureRaw = row.pressureratingkg || row.pressure || row.kg || null
    const coilLengthRaw = row.coillengthm || row.lengthm || row.coillength || row.length || null
    const minStockRaw = row.minstockthreshold || row.minstock || row.threshold || null
    const statusRaw = row.status || 'Active'

    // Validation
    if (!skuRaw) {
      result.failed++
      result.errors.push({ row: rowNum, error: 'Missing product SKU / Code' })
      return
    }
    if (!nameRaw) {
      result.failed++
      result.errors.push({ row: rowNum, sku: String(skuRaw), error: 'Missing product Name' })
      return
    }

    const sku = String(skuRaw).trim().toUpperCase()
    const name = String(nameRaw).trim()

    // Resolve Category
    let resolvedCategoryId = categories[0]?.id || 'c-1'
    if (categoryRaw) {
      const catStr = String(categoryRaw).toLowerCase()
      const matched = categories.find(c => {
        const cName = c.name.toLowerCase()
        const cCode = c.code.toLowerCase()
        return cName.includes(catStr) || catStr.includes(cName) || cCode === catStr
      })
      if (matched) {
        resolvedCategoryId = matched.id
      } else if (catStr.includes('pvc') && !catStr.includes('cpvc')) {
        resolvedCategoryId = 'c-1'
      } else if (catStr.includes('hdpe')) {
        resolvedCategoryId = 'c-2'
      } else if (catStr.includes('swr')) {
        resolvedCategoryId = 'c-3'
      } else if (catStr.includes('cpvc')) {
        resolvedCategoryId = 'c-4'
      } else if (catStr.includes('fitting')) {
        resolvedCategoryId = 'c-5'
      } else if (catStr.includes('tank')) {
        resolvedCategoryId = 'c-6'
      }
    }

    // Resolve Unit
    let resolvedUnit: any = 'piece'
    const uStr = String(unitRaw).toLowerCase()
    if (uStr.includes('coil')) resolvedUnit = 'coil'
    else if (uStr.includes('metre') || uStr.includes('meter') || uStr === 'm') resolvedUnit = 'metre'
    else if (uStr.includes('tank')) resolvedUnit = 'tank'
    else if (uStr.includes('box')) resolvedUnit = 'box'
    else if (uStr.includes('bundle')) resolvedUnit = 'bundle'
    else if (uStr.includes('kg')) resolvedUnit = 'kg'
    else resolvedUnit = 'piece'

    // Parse numeric fields
    const parsedRate = Number(rateRaw) || 0
    const parsedGst = Number(gstRaw) || 18
    const parsedDiameter = diameterRaw ? Number(diameterRaw) || null : null
    const parsedPressure = pressureRaw ? Number(pressureRaw) || null : null
    const parsedCoilLength = coilLengthRaw ? Number(coilLengthRaw) || null : null
    const parsedMinStock = minStockRaw ? Number(minStockRaw) || null : null
    const parsedIsActive = String(statusRaw).toLowerCase() !== 'inactive'

    const existingIndex = updatedProductsList.findIndex(p => p.sku === sku)

    if (existingIndex >= 0) {
      if (duplicateStrategy === 'skip') {
        result.skipped++
        return
      }

      // Update existing product
      const existing = updatedProductsList[existingIndex]
      updatedProductsList[existingIndex] = {
        ...existing,
        name,
        category_id: resolvedCategoryId,
        unit: resolvedUnit,
        rate: parsedRate,
        gst_percent: parsedGst,
        grade: gradeRaw ? String(gradeRaw) : existing.grade,
        diameter_mm: parsedDiameter ?? existing.diameter_mm,
        pressure_rating_kg: parsedPressure ?? existing.pressure_rating_kg,
        coil_length_m: parsedCoilLength ?? existing.coil_length_m,
        min_stock_threshold: parsedMinStock ?? existing.min_stock_threshold,
        is_active: parsedIsActive,
        updated_at: new Date().toISOString()
      }
      result.updated++
    } else {
      // Create new product
      const newProd: Product = {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku,
        name,
        category_id: resolvedCategoryId,
        grade: gradeRaw ? String(gradeRaw) : null,
        diameter_mm: parsedDiameter,
        pressure_rating_kg: parsedPressure,
        coil_length_m: parsedCoilLength,
        unit: resolvedUnit,
        rate: parsedRate,
        gst_percent: parsedGst,
        min_stock_threshold: parsedMinStock,
        is_active: parsedIsActive,
        notes: `Imported via CSV on ${new Date().toISOString().split('T')[0]}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      updatedProductsList.push(newProd)
      result.created++

      // Ensure zero balance row exists across warehouses
      for (const wh of warehouses) {
        const balKey = `bal-${newProd.id}-${wh.id}`
        const balances = getStore<StockBalance[]>('stock_balances', [])
        if (!balances.some(b => b.product_id === newProd.id && b.warehouse_id === wh.id)) {
          balances.push({
            id: balKey,
            product_id: newProd.id,
            warehouse_id: wh.id,
            quantity: 0,
            last_updated: new Date().toISOString()
          })
          setStore('stock_balances', balances)
        }
      }
    }
  })

  // Save updated product catalog
  setStore('products', updatedProductsList)

  logAudit({
    actor_id: actor?.id || 'admin',
    actor_name: actor?.full_name || 'System Admin',
    actor_role: actor?.role || 'admin',
    action: 'IMPORT_PRODUCTS_CSV',
    entity_type: 'PRODUCT_CATALOG',
    entity_reference: `CSV-IMPORT-${new Date().toISOString().split('T')[0]}`,
    result: 'success',
    change_summary: `Imported CSV: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed out of ${result.total_processed} rows.`
  })

  return result
}

// ==================== CURRENT STOCK VALUATION REPORT SERVICE ====================

export function getProductDiscountPercent(productId: string, categoryId: string): number {
  const today = new Date().toISOString().slice(0, 10)
  const rules = getStore<PriceRule[]>('price_rules', EMPTY_PRICE_RULES).filter(r =>
    r.is_active &&
    r.effective_from <= today &&
    (!r.effective_to || r.effective_to >= today)
  )

  const prodRule = rules.find(r => r.product_id === productId && r.rule_type === 'product_discount')
  if (prodRule) return prodRule.discount_percent

  const catRule = rules.find(r => r.category_id === categoryId && r.rule_type === 'category_discount')
  if (catRule) return catRule.discount_percent

  return 0.0
}

export function getCurrentStockReportData(): {
  report_date: string
  categories: {
    category_id: string
    category_name: string
    code: string
    unit_label: string
    discount_percent: number
    lines: {
      sr_no: number
      product_id: string
      sku: string
      item_name: string
      unit: string
      quantity: number
      discount_percent: number
      rate: number
      is_pending: boolean
      amount_after_discount: number
    }[]
    total_quantity: number
    subtotal_before_gst: number
    gst_amount: number
    total_incl_gst: number
    has_pending: boolean
    pending_count: number
  }[]
  subtotal_before_gst: number
  gst_percent: number | null
  gst_amount: number
  grand_total: number
  total_priced_items_count: number
  total_pending_items_count: number
} {
  const allProducts = getProducts().filter(p => p.is_active)
  const balances = getStockBalances()

  // Calculate total stock per product across all warehouses
  const stockMap: Record<string, number> = {}
  for (const b of balances) {
    stockMap[b.product_id] = (stockMap[b.product_id] || 0) + b.quantity
  }

  const categoryResults = getCategories()
    .filter(category => allProducts.some(product => product.category_id === category.id))
    .map(category => {
    const prods = allProducts.filter(p => p.category_id === category.id)
    const units = [...new Set(prods.map(product => product.unit))]
    let totalQty = 0
    let subtotal = 0
    let grossSubtotal = 0
    let pendingCount = 0

    const lines = prods.map((p, idx) => {
      const qty = stockMap[p.id] || 0
      totalQty += qty
      const disc = getProductDiscountPercent(p.id, p.category_id)

      const isPending = !Number.isFinite(p.rate) || p.rate <= 0

      let amount = 0
      if (isPending) {
        pendingCount++
      } else {
        grossSubtotal += qty * p.rate
        amount = Math.round(qty * p.rate * (1 - disc / 100) * 100) / 100
        subtotal += amount
      }

      return {
        sr_no: idx + 1,
        product_id: p.id,
        sku: p.sku,
        item_name: p.name,
        unit: p.unit,
        quantity: qty,
        discount_percent: disc,
        rate: p.rate || 0,
        is_pending: Boolean(isPending),
        amount_after_discount: amount
      }
    })

    const gstAmount = Math.round(subtotal * 0.18 * 100) / 100
    const totalInclGst = Math.round((subtotal + gstAmount) * 100) / 100

    return {
      category_id: category.id,
      category_name: category.name,
      code: category.code,
      unit_label: units.length === 1 ? getUnitLabel(units[0]) : 'Mixed units',
      discount_percent: grossSubtotal > 0
        ? Math.round((1 - subtotal / grossSubtotal) * 10000) / 100
        : getProductDiscountPercent('', category.id),
      lines,
      total_quantity: totalQty,
      subtotal_before_gst: Math.round(subtotal * 100) / 100,
      gst_amount: gstAmount,
      total_incl_gst: totalInclGst,
      has_pending: pendingCount > 0,
      pending_count: pendingCount
    }
  })

  // Calculate Overall Grand Totals
  const overallSubtotal = Math.round(categoryResults.reduce((sum, c) => sum + c.subtotal_before_gst, 0) * 100) / 100
  const overallGst = Math.round(overallSubtotal * 0.18 * 100) / 100
  const grandTotal = Math.round((overallSubtotal + overallGst) * 100) / 100

  const pricedCount = categoryResults.reduce((sum, c) => sum + c.lines.filter(l => !l.is_pending).length, 0)
  const pendingCount = categoryResults.reduce((sum, c) => sum + c.pending_count, 0)

  return {
    report_date: new Date().toISOString().split('T')[0],
    categories: categoryResults,
    subtotal_before_gst: overallSubtotal,
    gst_percent: 18,
    gst_amount: overallGst,
    grand_total: grandTotal,
    total_priced_items_count: pricedCount,
    total_pending_items_count: pendingCount
  }
}

