// ==================== User & Auth ====================
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'staff' | 'driver' | 'cleaner' | 'other'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  username: string
  role: UserRole
  phone?: string | null
  email?: string | null
  avatar_url?: string | null
  warehouse_id?: string | null
  employee_id?: string | null
  address?: string | null
  is_active: boolean
  permissions: Record<string, boolean>
  created_at: string
  updated_at: string
}

// ==================== Vehicles ====================
export interface Vehicle {
  id: string
  name: string
  registration_number: string
  vehicle_type: string
  insurance_policy_no?: string | null
  insurance_expiry_date?: string | null
  puc_certificate_no?: string | null
  puc_expiry_date?: string | null
  owner_name?: string | null
  contact_number?: string | null
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

// ==================== Outward Deliveries ====================
export type DeliveryStatus = 'awaiting_return' | 'completed' | 'draft' | 'cancelled'

export interface DeliveryItem {
  id: string
  delivery_id: string
  product_id: string
  product?: Product
  quantity: number
  unit: string
  size_label?: string
}

export interface OutwardDelivery {
  id: string
  delivery_ref: string
  warehouse_id: string
  warehouse?: Warehouse
  date: string
  do_number: string
  memo_number: string
  customer_name: string
  city: string
  delivery_address?: string | null
  delivery_notes?: string | null
  fittings_details?: string | null

  // Vehicle details
  vehicle_id?: string | null
  vehicle?: Vehicle
  other_vehicle_number?: string | null
  vehicle_registration_number: string

  // Driver details
  driver_id?: string | null
  driver_name: string
  other_driver_phone?: string | null
  other_driver_address?: string | null

  // Odometer details
  vehicle_out_km: number
  dispatch_timestamp: string
  vehicle_in_km?: number | null
  return_timestamp?: string | null
  distance_travelled?: number | null
  return_notes?: string | null
  return_updated_by?: string | null

  status: DeliveryStatus
  items: DeliveryItem[]

  created_by: string
  creator_name?: string
  created_at: string
  updated_at?: string
}

// ==================== Inward Stock Entries ====================
export interface InwardStockLine {
  id: string
  entry_id: string
  category_id: string
  product_id: string
  product?: Product
  quantity: number
  unit: string
}

export interface InwardStockEntry {
  id: string
  reference_no: string
  warehouse_id: string
  warehouse?: Warehouse
  entry_date: string
  challan_no: string
  supplier_name: string
  notes?: string | null
  status: 'draft' | 'saved'
  lines: InwardStockLine[]
  created_by: string
  creator_name?: string
  created_at: string
  updated_at?: string
}

// ==================== Locations / Warehouses ====================
export interface Warehouse {
  id: string
  name: string
  code: string
  address?: string | null
  city?: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

// ==================== Categories ====================
export interface Category {
  id: string
  name: string
  code: string
  description?: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at?: string
}

// ==================== Products ====================
export type ProductUnit = 'piece' | 'coil' | 'metre' | 'tank' | 'box' | 'kg' | 'litre'

export interface Product {
  id: string
  sku: string
  name: string
  category_id: string
  category?: Category
  grade?: string | null
  diameter_mm?: number | null
  pressure_rating_kg?: number | null
  weight_kg?: number | null
  coil_length_m?: number | null
  unit: ProductUnit
  rate: number
  gst_percent: number
  min_stock_threshold?: number | null
  is_active: boolean
  image_url?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

// ==================== Stock Balances ====================
export interface StockBalance {
  id: string
  product_id: string
  product?: Product
  warehouse_id: string
  warehouse?: Warehouse
  quantity: number
  last_updated: string
}

// ==================== Stock Movements ====================
export type MovementType = 'inward' | 'outward' | 'return' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'opening'

export interface StockMovement {
  id: string
  reference_no: string
  movement_type: MovementType
  product_id: string
  product?: Product
  warehouse_id: string
  warehouse?: Warehouse
  dest_warehouse_id?: string | null
  dest_warehouse?: Warehouse
  quantity: number
  unit_rate?: number | null
  challan_no?: string | null
  supplier_customer?: string | null
  notes?: string | null
  created_by: string
  creator_name?: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'posted'
  posted_at?: string | null
  created_at: string
}

// ==================== Daily Stock Reports ====================
export type ReportStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'posted' | 'completed'

export interface DailyStockReport {
  id: string
  report_date: string
  warehouse_id: string
  warehouse?: Warehouse
  created_by: string
  creator_name?: string
  status: ReportStatus
  notes?: string | null
  submitted_at?: string | null
  approved_by?: string | null
  approved_at?: string | null
  rejected_reason?: string | null
  created_at: string
  updated_at: string
  lines?: DailyStockReportLine[]
}

export interface DailyStockReportLine {
  id: string
  report_id: string
  product_id: string
  product?: Product
  category_id: string
  opening_stock: number
  inward_qty: number
  outward_qty: number
  closing_stock: number
  notes?: string | null
  created_at: string
}

// ==================== Physical Counts ====================
export interface PhysicalCount {
  id: string
  reference_no: string
  count_date: string
  warehouse_id: string
  warehouse?: Warehouse
  created_by: string
  creator_name?: string
  status: ReportStatus
  notes?: string | null
  created_at: string
  lines?: PhysicalCountLine[]
}

export interface PhysicalCountLine {
  id: string
  count_id: string
  product_id: string
  product?: Product
  system_stock: number
  counted_stock: number
  variance: number
  notes?: string | null
  status: 'matched' | 'discrepancy' | 'approved' | 'rejected'
}

// ==================== Approvals ====================
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'correction_requested'

export interface ApprovalRequest {
  id: string
  reference_no: string
  request_type: 'stock_report' | 'movement' | 'physical_count' | 'adjustment'
  entity_id: string
  created_by: string
  creator_name?: string
  warehouse_id?: string | null
  warehouse?: Warehouse
  summary?: string | null
  reason?: string | null
  status: ApprovalStatus
  reviewed_by?: string | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  created_at: string
}

// ==================== Rates & Discounts ====================
export interface PriceRule {
  id: string
  name: string
  product_id?: string | null
  product?: Product
  category_id?: string | null
  category?: Category
  rule_type: 'standard' | 'category_discount' | 'product_discount' | 'quantity_discount'
  discount_percent: number
  min_quantity?: number | null
  effective_from: string
  effective_to?: string | null
  is_active: boolean
  created_at: string
}

// ==================== Audit Logs ====================
export interface AuditLog {
  id: string
  timestamp: string
  actor_id: string
  actor_name: string
  actor_role: string
  action: string
  entity_type: string
  entity_reference: string
  warehouse_name?: string | null
  result: 'success' | 'failure'
  change_summary: string
}

// ==================== Current Stock Report & Valuation ====================
export interface StockValuationLine {
  sr_no: number
  category_id: string
  category_name: string
  product_id: string
  sku: string
  item_name: string
  unit: string
  quantity: number
  discount_label: string
  discount_percent: number
  rate: number
  is_pending: boolean
  amount_after_discount: number
}

export interface StockCategorySummary {
  category_id: string
  category_name: string
  code: string
  lines: StockValuationLine[]
  total_quantity: number
  unit_label: string
  discount_percent: number
  subtotal_before_gst: number
  gst_amount: number
  total_incl_gst: number
  has_pending: boolean
  pending_count: number
}

export interface CurrentStockReportData {
  report_date: string
  pvc: StockCategorySummary
  hdpe: StockCategorySummary
  swr: StockCategorySummary
  tank: StockCategorySummary
  other?: StockCategorySummary
  categories: StockCategorySummary[]
  subtotal_before_gst: number
  gst_percent: number
  gst_amount: number
  grand_total: number
  total_priced_items_count: number
  total_pending_items_count: number
}

// ==================== CSV Product Import ====================
export interface CSVProductImportRow {
  row_number: number
  sku: string
  name: string
  category_name: string
  unit: string
  rate: number
  gst_percent: number
  grade?: string
  diameter_mm?: number
  pressure_rating_kg?: number
  coil_length_m?: number
  min_stock_threshold?: number
  discount_percent?: number
  status?: string
  is_valid: boolean
  error?: string
  is_duplicate: boolean
}

export interface CSVImportResult {
  total_processed: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { row: number; sku?: string; error: string }[]
}

// ==================== UI State Helpers ====================
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  variant: ToastVariant
  title: string
  message?: string
}
