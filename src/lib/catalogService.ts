import { getSupabase } from './supabase'
import type { Category, Product, ProductUnit, Warehouse } from '../types'

export type CategoryInput = Pick<Category, 'name' | 'code' | 'description' | 'is_active' | 'sort_order'> & {
  id?: string
}

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'> & {
  id?: string
}

export type WarehouseInput = Pick<Warehouse, 'name' | 'code' | 'address' | 'city' | 'is_active'> & {
  id?: string
}

export interface WarehouseStockRow {
  warehouse_id: string
  quantity: number
}

export interface ProductImportResult {
  total_processed: number
  created: number
  updated: number
  skipped: number
  failed: number
  errors: { row: number; sku?: string; error: string }[]
}

interface DatabaseError {
  code?: string
  message: string
}

function databaseError(action: string, error: DatabaseError): Error {
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message)) {
    return new Error(`Permission denied while ${action}. Check that your profile is active and has Admin or Manager access.`)
  }
  if (error.code === '23505') {
    return new Error(`A record with the same unique value already exists. ${error.message}`)
  }
  if (error.code === '23503') {
    return new Error(`This record is still referenced by other database records and cannot be deleted. ${error.message}`)
  }
  if (error.code === 'PGRST205') {
    return new Error(`The required Supabase table is not available. Apply the reviewed catalog migration first. ${error.message}`)
  }
  return new Error(`Unable to ${action}: ${error.message}`)
}

function requiredData<T>(action: string, data: T | null, error: DatabaseError | null): T {
  if (error) throw databaseError(action, error)
  if (data === null) throw new Error(`Unable to ${action}: Supabase returned no record.`)
  return data
}

export async function loadCategories(): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name')

  return requiredData('load categories', data, error) as Category[]
}

export async function loadProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*, category:categories(*)')
    .order('sku')

  return requiredData('load products', data, error) as Product[]
}

export async function loadWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await getSupabase()
    .from('warehouses')
    .select('*')
    .order('name')

  return requiredData('load warehouses', data, error) as Warehouse[]
}

export async function loadWarehouseStockRows(): Promise<WarehouseStockRow[]> {
  const { data, error } = await getSupabase()
    .from('stock_balances')
    .select('warehouse_id, quantity')

  return requiredData('load warehouse stock summaries', data, error) as WarehouseStockRow[]
}

export async function saveCategoryRecord(input: CategoryInput): Promise<Category> {
  const { id, ...values } = input
  const result = id
    ? await getSupabase().from('categories').update(values).eq('id', id).select('*').single()
    : await getSupabase().from('categories').insert(values).select('*').single()

  return requiredData(id ? 'update category' : 'create category', result.data, result.error) as Category
}

export async function saveProductRecord(input: ProductInput): Promise<Product> {
  const { id, ...values } = input
  const result = id
    ? await getSupabase().from('products').update(values).eq('id', id).select('*, category:categories(*)').single()
    : await getSupabase().from('products').insert(values).select('*, category:categories(*)').single()

  return requiredData(id ? 'update product' : 'create product', result.data, result.error) as Product
}

export async function saveWarehouseRecord(input: WarehouseInput): Promise<Warehouse> {
  const { id, ...values } = input
  const result = id
    ? await getSupabase().from('warehouses').update(values).eq('id', id).select('*').single()
    : await getSupabase().from('warehouses').insert(values).select('*').single()

  return requiredData(id ? 'update warehouse' : 'create warehouse', result.data, result.error) as Warehouse
}

export async function deleteProductRecord(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_catalog_product', { p_product_id: id })
  if (error) throw databaseError('delete product', error)
}

export async function deleteCategoryRecord(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_catalog_category', { p_category_id: id })
  if (error) throw databaseError('delete category', error)
}

export async function deleteWarehouseRecord(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_catalog_warehouse', { p_warehouse_id: id })
  if (error) throw databaseError('delete warehouse', error)
}

function normalizedKey(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s_-]+/g, '') : ''
}

function rawValue(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function parseImportNumber(value: unknown, fallback: number | null): number | null {
  if (value === undefined || value === null || value === '') return fallback
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function parseImportUnit(value: unknown): ProductUnit | null {
  const normalized = String(value || 'piece').trim().toLowerCase()
  if (normalized.includes('coil')) return 'coil'
  if (normalized.includes('metre') || normalized.includes('meter') || normalized === 'm') return 'metre'
  if (normalized.includes('tank')) return 'tank'
  if (normalized.includes('box')) return 'box'
  if (normalized === 'kg' || normalized.includes('kilogram')) return 'kg'
  if (normalized === 'l' || normalized.includes('litre') || normalized.includes('liter')) return 'litre'
  if (normalized === 'piece' || normalized === 'pieces' || normalized === 'pcs' || normalized === 'pc') return 'piece'
  return null
}

export async function importProductsToSupabase(
  inputRows: Record<string, unknown>[],
  categories: Category[],
  existingProducts: Product[],
  duplicateStrategy: 'update' | 'skip'
): Promise<ProductImportResult> {
  const result: ProductImportResult = {
    total_processed: inputRows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  }
  const categoryById = new Map(categories.map(category => [category.id, category]))
  const existingBySku = new Map(existingProducts.map(product => [product.sku.toUpperCase(), product]))
  const seenSkus = new Set<string>()
  const records: (Omit<ProductInput, 'id'> & { id?: string })[] = []
  const recordActions: ('created' | 'updated')[] = []

  inputRows.forEach((rawRow, index) => {
    const row: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawRow)) row[normalizedKey(key)] = value
    const rowNumber = index + 1
    const skuRaw = rawValue(row, 'sku', 'itemcode', 'productsku', 'partnumber', 'id')
    const nameRaw = rawValue(row, 'name', 'productname', 'itemname', 'description')
    const categoryRaw = rawValue(row, 'category', 'categoryname', 'cat', 'group')
    const sku = typeof skuRaw === 'string' ? skuRaw.trim().toUpperCase() : ''
    const productName = typeof nameRaw === 'string' ? nameRaw.trim() : ''

    const fail = (message: string) => {
      result.failed++
      result.errors.push({ row: rowNumber, sku: sku || undefined, error: message })
    }

    if (!sku) return fail('Missing product SKU / Code.')
    if (!productName) return fail('Missing product name.')
    if (seenSkus.has(sku)) return fail('Duplicate SKU in the uploaded file.')
    seenSkus.add(sku)

    const matchedExisting = existingBySku.get(sku)
    if (matchedExisting && duplicateStrategy === 'skip') {
      result.skipped++
      return
    }

    let category: Category | undefined
    if (categoryRaw !== undefined) {
      const categoryKey = String(categoryRaw).trim().toLowerCase()
      const exactMatches = categories.filter(item =>
        item.code.toLowerCase() === categoryKey || item.name.toLowerCase() === categoryKey
      )
      const partialMatches = exactMatches.length === 0
        ? categories.filter(item => item.name.toLowerCase().includes(categoryKey))
        : exactMatches
      if (partialMatches.length !== 1) {
        return fail(partialMatches.length > 1
          ? 'Category name is ambiguous; use an exact category name or code.'
          : `Category "${String(categoryRaw)}" does not exist.`)
      }
      category = partialMatches[0]
    } else if (categories.length === 1) {
      category = categories[0]
    }

    if (!category || !categoryById.has(category.id)) {
      return fail('A valid category is required. Select an existing category name or code.')
    }

    const unit = parseImportUnit(rawValue(row, 'unit', 'uom'))
    if (!unit) return fail('Unit must be piece, coil, metre, tank, box, kg, or litre.')

    const rate = parseImportNumber(rawValue(row, 'rateinr', 'rate', 'price', 'unitprice', 'mrp'), 0)
    const gstPercent = parseImportNumber(rawValue(row, 'gstpercent', 'gst', 'tax'), 18)
    const diameter = parseImportNumber(rawValue(row, 'diametermm', 'diameter', 'size', 'dia'), null)
    const pressure = parseImportNumber(rawValue(row, 'pressureratingkg', 'pressure', 'kg'), null)
    const weight = parseImportNumber(rawValue(row, 'weightkg', 'weight'), null)
    const coilLength = parseImportNumber(rawValue(row, 'coillengthm', 'lengthm', 'coillength', 'length'), null)
    const minStock = parseImportNumber(rawValue(row, 'minstockthreshold', 'minstock', 'threshold'), null)
    const numbers = [rate, gstPercent, diameter, pressure, weight, coilLength, minStock]
    if (numbers.some(value => value !== null && (!Number.isFinite(value) || value < 0))) {
      return fail('Numeric values must be valid non-negative numbers.')
    }

    const record: Omit<ProductInput, 'id'> & { id?: string } = {
      ...(matchedExisting ? { id: matchedExisting.id } : {}),
      sku,
      name: productName,
      category_id: category.id,
      grade: String(rawValue(row, 'grade', 'class', 'type') || matchedExisting?.grade || '').trim() || null,
      diameter_mm: diameter ?? matchedExisting?.diameter_mm ?? null,
      pressure_rating_kg: pressure ?? matchedExisting?.pressure_rating_kg ?? null,
      weight_kg: weight ?? matchedExisting?.weight_kg ?? null,
      coil_length_m: coilLength ?? matchedExisting?.coil_length_m ?? null,
      unit,
      rate: rate ?? 0,
      gst_percent: gstPercent ?? 18,
      min_stock_threshold: minStock ?? matchedExisting?.min_stock_threshold ?? null,
      is_active: String(rawValue(row, 'status') || 'active').toLowerCase() !== 'inactive',
      image_url: matchedExisting?.image_url ?? null,
      notes: matchedExisting?.notes ?? null
    }

    records.push(record)
    recordActions.push(matchedExisting ? 'updated' : 'created')
  })

  if (records.length === 0) return result

  const { error } = await getSupabase().from('products').upsert(records, { onConflict: 'sku' })
  if (error) throw databaseError('import products', error)

  for (const action of recordActions) result[action]++
  return result
}
