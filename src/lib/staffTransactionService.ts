import { getSupabase } from './supabase'
import type { InwardStockEntry, OutwardDelivery, Profile } from '../types'

function fail(action: string, error: { message: string; code?: string } | null): void {
  if (!error) return
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message)) {
    throw new Error(`Supabase denied ${action}. Check the active staff profile, assigned godown, and migration 004 policies/functions. ${error.message}`)
  }
  throw new Error(`Unable to ${action}: ${error.message}`)
}

/** Persists an inward entry transactionally in Supabase. This must succeed before the UI reports success. */
export async function persistInwardEntry(entry: Omit<InwardStockEntry, 'id' | 'created_at'>, actor: Profile): Promise<void> {
  const payload = {
    reference_no: entry.reference_no,
    warehouse_id: entry.warehouse_id,
    entry_date: entry.entry_date,
    challan_no: entry.challan_no,
    supplier_name: entry.supplier_name,
    notes: entry.notes ?? null,
    status: entry.status,
    created_by: actor.id,
    lines: entry.lines.filter(line => Number(line.quantity) > 0).map(line => ({
      category_id: line.category_id,
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit: line.unit
    }))
  }
  const { error } = await getSupabase().rpc('save_staff_inward_entry', { p_entry: payload })
  fail('save inward entry', error)
}

/** Persists an outward delivery and posts stock deductions atomically in Supabase. */
export async function persistOutwardDelivery(delivery: Omit<OutwardDelivery, 'id' | 'created_at'>, actor: Profile): Promise<void> {
  const payload = {
    delivery_ref: delivery.delivery_ref,
    warehouse_id: delivery.warehouse_id,
    date: delivery.date,
    do_number: delivery.do_number,
    memo_number: delivery.memo_number,
    customer_name: delivery.customer_name,
    city: delivery.city,
    delivery_address: delivery.delivery_address ?? null,
    delivery_notes: delivery.delivery_notes ?? null,
    fittings_details: delivery.fittings_details ?? null,
    vehicle_id: delivery.vehicle_id ?? null,
    other_vehicle_number: delivery.other_vehicle_number ?? null,
    vehicle_registration_number: delivery.vehicle_registration_number,
    driver_id: delivery.driver_id ?? null,
    driver_name: delivery.driver_name,
    other_driver_phone: delivery.other_driver_phone ?? null,
    other_driver_address: delivery.other_driver_address ?? null,
    vehicle_out_km: Number(delivery.vehicle_out_km) || 0,
    status: delivery.status,
    created_by: actor.id,
    items: delivery.items.filter(item => Number(item.quantity) > 0).map(item => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit: item.unit,
      size_label: item.size_label ?? null
    }))
  }
  const { error } = await getSupabase().rpc('save_staff_outward_delivery', { p_delivery: payload })
  fail('save outward delivery', error)
}
