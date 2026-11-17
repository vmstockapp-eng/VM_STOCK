-- StockFlow Pro: atomic persistence for staff inward/outward entries.
-- Apply only after reviewing against the live schema; this migration is additive.

CREATE OR REPLACE FUNCTION public.save_staff_inward_entry(p_entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
  v_role text := public.get_current_user_role()::text;
  v_entry_id uuid;
  v_existing_status text;
  v_status text := COALESCE(p_entry->>'status', 'draft');
  v_warehouse_id uuid := (p_entry->>'warehouse_id')::uuid;
  v_ref text := p_entry->>'reference_no';
  v_line jsonb;
  v_line_id uuid;
  v_product_id uuid;
  v_qty numeric;
  v_unit public.product_unit;
  v_i integer := 0;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Active StockFlow profile required'; END IF;
  IF v_ref IS NULL OR btrim(v_ref) = '' THEN RAISE EXCEPTION 'Entry reference is required'; END IF;
  IF v_status NOT IN ('draft','saved') THEN RAISE EXCEPTION 'Invalid inward status'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('admin','manager','supervisor','staff') THEN
    RAISE EXCEPTION 'Your role is not allowed to save staff inward entries';
  END IF;
  IF v_role = 'staff' AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_profile_id AND p.warehouse_id=v_warehouse_id
  ) THEN
    RAISE EXCEPTION 'You can only save entries for your assigned godown';
  END IF;

  SELECT id, status INTO v_entry_id, v_existing_status
  FROM public.inward_stock_entries WHERE reference_no=v_ref FOR UPDATE;

  IF v_entry_id IS NOT NULL AND (v_existing_status <> 'draft' OR NOT EXISTS (
    SELECT 1 FROM public.inward_stock_entries WHERE id=v_entry_id AND created_by=v_profile_id
  )) THEN
    IF v_existing_status = 'saved' AND EXISTS (
      SELECT 1 FROM public.inward_stock_entries WHERE id=v_entry_id AND created_by=v_profile_id
    ) THEN
      RETURN jsonb_build_object('id', v_entry_id, 'reference_no', v_ref, 'status', 'saved', 'already_saved', true);
    END IF;
    RAISE EXCEPTION 'This inward entry cannot be edited by the current user';
  END IF;

  IF v_entry_id IS NULL THEN
    INSERT INTO public.inward_stock_entries(reference_no, warehouse_id, entry_date, challan_no, supplier_name, notes, status, created_by)
    VALUES (v_ref, v_warehouse_id, (p_entry->>'entry_date')::date,
      COALESCE(p_entry->>'challan_no',''), COALESCE(p_entry->>'supplier_name',''), p_entry->>'notes', 'draft', v_profile_id)
    RETURNING id INTO v_entry_id;
  ELSE
    UPDATE public.inward_stock_entries SET warehouse_id=v_warehouse_id,
      entry_date=(p_entry->>'entry_date')::date, challan_no=COALESCE(p_entry->>'challan_no',''),
      supplier_name=COALESCE(p_entry->>'supplier_name',''), notes=p_entry->>'notes', updated_at=now()
    WHERE id=v_entry_id;
    DELETE FROM public.inward_stock_lines WHERE entry_id=v_entry_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(COALESCE(p_entry->'lines','[]'::jsonb)) LOOP
    v_qty := NULLIF(v_line->>'quantity','')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    v_product_id := (v_line->>'product_id')::uuid;
    v_unit := COALESCE(NULLIF(v_line->>'unit','')::public.product_unit, 'piece'::public.product_unit);
    INSERT INTO public.inward_stock_lines(entry_id, category_id, product_id, quantity, unit)
    VALUES (v_entry_id, (v_line->>'category_id')::uuid, v_product_id, v_qty, v_unit)
    RETURNING id INTO v_line_id;
    v_i := v_i + 1;

    IF v_status = 'saved' THEN
      INSERT INTO public.stock_balances(product_id, warehouse_id, quantity, last_updated)
      VALUES (v_product_id, v_warehouse_id, v_qty, now())
      ON CONFLICT (product_id, warehouse_id) DO UPDATE
      SET quantity=public.stock_balances.quantity + EXCLUDED.quantity, last_updated=now();
      INSERT INTO public.stock_movements(reference_no, movement_type, product_id, warehouse_id, quantity,
        challan_no, supplier_customer, notes, created_by, status, posted_at, source_type, source_id, source_line_id)
      VALUES (v_ref || '-L' || v_i, 'inward', v_product_id, v_warehouse_id, v_qty,
        p_entry->>'challan_no', p_entry->>'supplier_name', 'Staff inward entry ' || v_ref,
        v_profile_id, 'posted', now(), 'inward_entry', v_entry_id, v_line_id);
    END IF;
  END LOOP;

  UPDATE public.inward_stock_entries SET status=v_status, updated_at=now() WHERE id=v_entry_id;
  RETURN jsonb_build_object('id', v_entry_id, 'reference_no', v_ref, 'status', v_status, 'already_saved', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_staff_outward_delivery(p_delivery jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public.get_current_profile_id();
  v_role text := public.get_current_user_role()::text;
  v_delivery_id uuid;
  v_existing_status text;
  v_status text := COALESCE(p_delivery->>'status', 'draft');
  v_warehouse_id uuid := (p_delivery->>'warehouse_id')::uuid;
  v_ref text := p_delivery->>'delivery_ref';
  v_item jsonb;
  v_item_id uuid;
  v_product_id uuid;
  v_qty numeric;
  v_unit public.product_unit;
  v_available numeric;
  v_i integer := 0;
BEGIN
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'Active StockFlow profile required'; END IF;
  IF v_ref IS NULL OR btrim(v_ref) = '' THEN RAISE EXCEPTION 'Delivery reference is required'; END IF;
  IF v_status NOT IN ('draft','awaiting_return') THEN RAISE EXCEPTION 'Invalid delivery status'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('admin','manager','supervisor','staff') THEN
    RAISE EXCEPTION 'Your role is not allowed to save staff outward deliveries';
  END IF;
  IF v_role = 'staff' AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_profile_id AND p.warehouse_id=v_warehouse_id
  ) THEN
    RAISE EXCEPTION 'You can only save deliveries for your assigned godown';
  END IF;

  SELECT id, status INTO v_delivery_id, v_existing_status
  FROM public.outward_deliveries WHERE delivery_ref=v_ref FOR UPDATE;

  IF v_delivery_id IS NOT NULL AND (v_existing_status <> 'draft' OR NOT EXISTS (
    SELECT 1 FROM public.outward_deliveries WHERE id=v_delivery_id AND created_by=v_profile_id
  )) THEN
    IF v_existing_status IN ('awaiting_return','completed') AND EXISTS (
      SELECT 1 FROM public.outward_deliveries WHERE id=v_delivery_id AND created_by=v_profile_id
    ) THEN
      RETURN jsonb_build_object('id', v_delivery_id, 'delivery_ref', v_ref, 'status', v_existing_status, 'already_saved', true);
    END IF;
    RAISE EXCEPTION 'This delivery cannot be edited by the current user';
  END IF;

  IF v_delivery_id IS NULL THEN
    INSERT INTO public.outward_deliveries(delivery_ref, warehouse_id, delivery_date, do_number, memo_number,
      customer_name, city, delivery_address, delivery_notes, fittings_details, vehicle_id, other_vehicle_number,
      vehicle_registration_number, driver_id, driver_name, other_driver_phone, other_driver_address,
      vehicle_out_km, dispatch_timestamp, status, created_by)
    VALUES (v_ref, v_warehouse_id, (p_delivery->>'date')::date, COALESCE(p_delivery->>'do_number',''),
      COALESCE(p_delivery->>'memo_number',''), COALESCE(p_delivery->>'customer_name',''), COALESCE(p_delivery->>'city',''),
      p_delivery->>'delivery_address', p_delivery->>'delivery_notes', p_delivery->>'fittings_details',
      CASE WHEN COALESCE(p_delivery->>'vehicle_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_delivery->>'vehicle_id')::uuid ELSE NULL END,
      p_delivery->>'other_vehicle_number', COALESCE(p_delivery->>'vehicle_registration_number',''),
      CASE WHEN COALESCE(p_delivery->>'driver_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_delivery->>'driver_id')::uuid ELSE NULL END,
      COALESCE(p_delivery->>'driver_name',''), p_delivery->>'other_driver_phone', p_delivery->>'other_driver_address',
      COALESCE(NULLIF(p_delivery->>'vehicle_out_km','')::numeric,0), now(), 'draft', v_profile_id)
    RETURNING id INTO v_delivery_id;
  ELSE
    UPDATE public.outward_deliveries SET warehouse_id=v_warehouse_id, delivery_date=(p_delivery->>'date')::date,
      do_number=COALESCE(p_delivery->>'do_number',''), memo_number=COALESCE(p_delivery->>'memo_number',''),
      customer_name=COALESCE(p_delivery->>'customer_name',''), city=COALESCE(p_delivery->>'city',''),
      delivery_address=p_delivery->>'delivery_address', delivery_notes=p_delivery->>'delivery_notes',
      fittings_details=p_delivery->>'fittings_details', vehicle_registration_number=COALESCE(p_delivery->>'vehicle_registration_number',''),
      driver_name=COALESCE(p_delivery->>'driver_name',''), vehicle_out_km=COALESCE(NULLIF(p_delivery->>'vehicle_out_km','')::numeric,0),
      updated_at=now() WHERE id=v_delivery_id;
    DELETE FROM public.delivery_items WHERE delivery_id=v_delivery_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_delivery->'items','[]'::jsonb)) LOOP
    v_qty := NULLIF(v_item->>'quantity','')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    v_product_id := (v_item->>'product_id')::uuid;
    v_unit := COALESCE(NULLIF(v_item->>'unit','')::public.product_unit, 'piece'::public.product_unit);
    INSERT INTO public.delivery_items(delivery_id, product_id, quantity, unit, size_label)
    VALUES (v_delivery_id, v_product_id, v_qty, v_unit, v_item->>'size_label') RETURNING id INTO v_item_id;
    v_i := v_i + 1;
    IF v_status = 'awaiting_return' THEN
      SELECT COALESCE(quantity,0) INTO v_available FROM public.stock_balances
      WHERE product_id=v_product_id AND warehouse_id=v_warehouse_id FOR UPDATE;
      IF COALESCE(v_available,0) < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %. Available: %, requested: %', v_product_id, COALESCE(v_available,0), v_qty;
      END IF;
      UPDATE public.stock_balances SET quantity=quantity-v_qty, last_updated=now()
      WHERE product_id=v_product_id AND warehouse_id=v_warehouse_id;
      INSERT INTO public.stock_movements(reference_no, movement_type, product_id, warehouse_id, quantity,
        challan_no, supplier_customer, notes, created_by, status, posted_at, source_type, source_id, source_line_id)
      VALUES (v_ref || '-L' || v_i, 'outward', v_product_id, v_warehouse_id, v_qty,
        COALESCE(NULLIF(p_delivery->>'do_number',''), p_delivery->>'memo_number'),
        p_delivery->>'customer_name', 'Staff outward delivery ' || v_ref,
        v_profile_id, 'posted', now(), 'outward_delivery', v_delivery_id, v_item_id);
    END IF;
  END LOOP;

  UPDATE public.outward_deliveries SET status=v_status,
    dispatch_timestamp=CASE WHEN v_status='awaiting_return' THEN COALESCE(dispatch_timestamp,now()) ELSE dispatch_timestamp END,
    updated_at=now() WHERE id=v_delivery_id;
  RETURN jsonb_build_object('id', v_delivery_id, 'delivery_ref', v_ref, 'status', v_status, 'already_saved', false);
END;
$$;

REVOKE ALL ON FUNCTION public.save_staff_inward_entry(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_staff_outward_delivery(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_inward_entry(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_outward_delivery(jsonb) TO authenticated;

-- Enable row-change broadcasts for the shared inventory tables when not already published.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'categories','warehouses','products','stock_balances','stock_movements',
      'inward_stock_entries','inward_stock_lines','outward_deliveries','delivery_items'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
