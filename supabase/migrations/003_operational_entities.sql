-- Additive operational schema for the existing StockFlow Pro domain model.
-- This migration does not seed, update, or delete business records.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'driver';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaner';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.physical_counts
  ADD COLUMN IF NOT EXISTS reference_no text;

CREATE UNIQUE INDEX IF NOT EXISTS physical_counts_reference_no_uidx
  ON public.physical_counts (reference_no)
  WHERE reference_no IS NOT NULL;

ALTER TABLE public.price_rules
  ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS entity_reference text,
  ADD COLUMN IF NOT EXISTS warehouse_name text;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS source_line_id uuid;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_source_type_check
  CHECK (
    source_type IS NULL OR
    source_type IN ('inward_entry', 'outward_delivery', 'daily_stock_report', 'manual_adjustment', 'physical_count')
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_source_line_uidx
  ON public.stock_movements (source_type, source_id, source_line_id, movement_type)
  WHERE source_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_number text NOT NULL UNIQUE,
  vehicle_type text NOT NULL,
  insurance_policy_no text,
  insurance_expiry_date date,
  puc_certificate_no text,
  puc_expiry_date date,
  owner_name text,
  contact_number text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outward_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_ref text NOT NULL UNIQUE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  delivery_date date NOT NULL,
  do_number text NOT NULL DEFAULT '',
  memo_number text NOT NULL DEFAULT '',
  customer_name text NOT NULL,
  city text NOT NULL DEFAULT '',
  delivery_address text,
  delivery_notes text,
  fittings_details text,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  other_vehicle_number text,
  vehicle_registration_number text NOT NULL DEFAULT '',
  driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_name text NOT NULL DEFAULT '',
  other_driver_phone text,
  other_driver_address text,
  vehicle_out_km numeric(12, 2) NOT NULL DEFAULT 0,
  dispatch_timestamp timestamptz,
  vehicle_in_km numeric(12, 2),
  return_timestamp timestamptz,
  distance_travelled numeric(12, 2),
  return_notes text,
  return_updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'awaiting_return', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.outward_deliveries(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit public.product_unit NOT NULL,
  size_label text
);

CREATE TABLE IF NOT EXISTS public.inward_stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no text NOT NULL UNIQUE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  entry_date date NOT NULL,
  challan_no text NOT NULL DEFAULT '',
  supplier_name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inward_stock_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.inward_stock_entries(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit public.product_unit NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_name text,
  gstin text,
  phone text,
  email text,
  address text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outward_deliveries_warehouse_date
  ON public.outward_deliveries (warehouse_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_outward_deliveries_created_by
  ON public.outward_deliveries (created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery
  ON public.delivery_items (delivery_id);
CREATE INDEX IF NOT EXISTS idx_inward_entries_warehouse_date
  ON public.inward_stock_entries (warehouse_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_inward_entries_created_by
  ON public.inward_stock_entries (created_by);
CREATE INDEX IF NOT EXISTS idx_inward_lines_entry
  ON public.inward_stock_lines (entry_id);

CREATE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER outward_deliveries_updated_at
  BEFORE UPDATE ON public.outward_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER inward_stock_entries_updated_at
  BEFORE UPDATE ON public.inward_stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON public.warehouses;
CREATE POLICY "Active profiles can view warehouses"
  ON public.warehouses FOR SELECT TO authenticated
  USING (public.get_current_profile_id() IS NOT NULL);
CREATE POLICY "Managers can manage warehouses"
  ON public.warehouses FOR ALL TO authenticated
  USING (public.get_current_user_role()::text = 'manager')
  WITH CHECK (public.get_current_user_role()::text = 'manager');

DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;
CREATE POLICY "Active profiles can view categories"
  ON public.categories FOR SELECT TO authenticated
  USING (public.get_current_profile_id() IS NOT NULL);
CREATE POLICY "Managers can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.get_current_user_role()::text = 'manager')
  WITH CHECK (public.get_current_user_role()::text = 'manager');

DROP POLICY IF EXISTS "Authenticated users can view active products" ON public.products;
CREATE POLICY "Active profiles can view products"
  ON public.products FOR SELECT TO authenticated
  USING (public.get_current_profile_id() IS NOT NULL);
CREATE POLICY "Managers can manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.get_current_user_role()::text = 'manager')
  WITH CHECK (public.get_current_user_role()::text = 'manager');

CREATE POLICY "Managers can view all stock balances"
  ON public.stock_balances FOR SELECT TO authenticated
  USING (public.get_current_user_role()::text = 'manager');

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outward_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_stock_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (
    public.get_current_profile_id() IS NOT NULL
    AND (
      is_active
      OR public.get_current_user_role()::text IN ('admin', 'manager', 'supervisor')
    )
  );

CREATE POLICY "Admin and manager can manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.get_current_user_role()::text IN ('admin', 'manager'))
  WITH CHECK (public.get_current_user_role()::text IN ('admin', 'manager'));

CREATE POLICY "Users can view own deliveries"
  ON public.outward_deliveries FOR SELECT TO authenticated
  USING (created_by = public.get_current_profile_id());

CREATE POLICY "Managers can view all deliveries"
  ON public.outward_deliveries FOR SELECT TO authenticated
  USING (public.get_current_user_role()::text IN ('admin', 'manager', 'supervisor'));

CREATE POLICY "Users can create own delivery drafts"
  ON public.outward_deliveries FOR INSERT TO authenticated
  WITH CHECK (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
    AND (
      public.get_current_user_role()::text IN ('admin', 'manager')
      OR warehouse_id = (
        SELECT p.warehouse_id
        FROM public.profiles AS p
        WHERE p.id = public.get_current_profile_id()
      )
    )
  );

CREATE POLICY "Users can update own delivery drafts"
  ON public.outward_deliveries FOR UPDATE TO authenticated
  USING (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  )
  WITH CHECK (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  );

CREATE POLICY "Users can delete own delivery drafts"
  ON public.outward_deliveries FOR DELETE TO authenticated
  USING (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  );

CREATE POLICY "Users can view delivery items they can view"
  ON public.delivery_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.outward_deliveries AS d
      WHERE d.id = delivery_id
    )
  );

CREATE POLICY "Users can manage items in own delivery drafts"
  ON public.delivery_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.outward_deliveries AS d
      WHERE d.id = delivery_id
        AND d.created_by = public.get_current_profile_id()
        AND d.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.outward_deliveries AS d
      WHERE d.id = delivery_id
        AND d.created_by = public.get_current_profile_id()
        AND d.status = 'draft'
    )
  );

CREATE POLICY "Users can view own inward entries"
  ON public.inward_stock_entries FOR SELECT TO authenticated
  USING (created_by = public.get_current_profile_id());

CREATE POLICY "Managers can view all inward entries"
  ON public.inward_stock_entries FOR SELECT TO authenticated
  USING (public.get_current_user_role()::text IN ('admin', 'manager', 'supervisor'));

CREATE POLICY "Users can create own inward drafts"
  ON public.inward_stock_entries FOR INSERT TO authenticated
  WITH CHECK (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
    AND (
      public.get_current_user_role()::text IN ('admin', 'manager')
      OR warehouse_id = (
        SELECT p.warehouse_id
        FROM public.profiles AS p
        WHERE p.id = public.get_current_profile_id()
      )
    )
  );

CREATE POLICY "Users can update own inward drafts"
  ON public.inward_stock_entries FOR UPDATE TO authenticated
  USING (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  )
  WITH CHECK (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  );

CREATE POLICY "Users can delete own inward drafts"
  ON public.inward_stock_entries FOR DELETE TO authenticated
  USING (
    created_by = public.get_current_profile_id()
    AND status = 'draft'
  );

CREATE POLICY "Users can view inward lines they can view"
  ON public.inward_stock_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inward_stock_entries AS e
      WHERE e.id = entry_id
    )
  );

CREATE POLICY "Users can manage lines in own inward drafts"
  ON public.inward_stock_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.inward_stock_entries AS e
      WHERE e.id = entry_id
        AND e.created_by = public.get_current_profile_id()
        AND e.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.inward_stock_entries AS e
      WHERE e.id = entry_id
        AND e.created_by = public.get_current_profile_id()
        AND e.status = 'draft'
    )
  );

CREATE POLICY "Authenticated users can view company settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (public.get_current_profile_id() IS NOT NULL);

CREATE POLICY "Admin and manager can manage company settings"
  ON public.company_settings FOR ALL TO authenticated
  USING (public.get_current_user_role()::text IN ('admin', 'manager'))
  WITH CHECK (public.get_current_user_role()::text IN ('admin', 'manager'));

CREATE OR REPLACE FUNCTION public.delete_catalog_product(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_current_profile_id() IS NULL
     OR public.get_current_user_role()::text NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Insufficient permission to delete products'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.stock_balances WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.stock_movements WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.daily_stock_report_lines WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.physical_count_lines WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.price_rules WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.delivery_items WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM public.inward_stock_lines WHERE product_id = p_product_id) THEN
    RAISE EXCEPTION 'Cannot delete product while stock or history records reference it'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.products WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_catalog_category(p_category_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_current_profile_id() IS NULL
     OR public.get_current_user_role()::text NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Insufficient permission to delete categories'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.categories WHERE id = p_category_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.products WHERE category_id = p_category_id)
     OR EXISTS (SELECT 1 FROM public.daily_stock_report_lines WHERE category_id = p_category_id)
     OR EXISTS (SELECT 1 FROM public.inward_stock_lines WHERE category_id = p_category_id)
     OR EXISTS (SELECT 1 FROM public.price_rules WHERE category_id = p_category_id) THEN
    RAISE EXCEPTION 'Cannot delete category while products, pricing rules, or history records reference it'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.categories WHERE id = p_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_catalog_warehouse(p_warehouse_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_current_profile_id() IS NULL
     OR public.get_current_user_role()::text NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Insufficient permission to delete warehouses'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.warehouses WHERE id = p_warehouse_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.stock_balances WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.stock_movements WHERE warehouse_id = p_warehouse_id OR dest_warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.daily_stock_reports WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.physical_counts WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.approval_requests WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.outward_deliveries WHERE warehouse_id = p_warehouse_id)
     OR EXISTS (SELECT 1 FROM public.inward_stock_entries WHERE warehouse_id = p_warehouse_id) THEN
    RAISE EXCEPTION 'Cannot delete warehouse while staff, stock, or history records reference it'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.warehouses WHERE id = p_warehouse_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_catalog_product(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_catalog_category(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_catalog_warehouse(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_catalog_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_catalog_category(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_catalog_warehouse(uuid) TO authenticated;

REVOKE ALL ON public.vehicles,
  public.outward_deliveries,
  public.delivery_items,
  public.inward_stock_entries,
  public.inward_stock_lines,
  public.company_settings
  FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles,
  public.outward_deliveries,
  public.delivery_items,
  public.inward_stock_entries,
  public.inward_stock_lines,
  public.company_settings
  TO authenticated;

REVOKE ALL ON public.warehouses, public.categories, public.products FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.warehouses, public.categories, public.products
  TO authenticated;
REVOKE DELETE ON public.warehouses, public.categories, public.products FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.stock_balances, public.stock_movements FROM anon, authenticated;
REVOKE INSERT ON public.audit_logs FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_stock_movement(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_movement(uuid, uuid) TO service_role;

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, email, avatar_url, address)
  ON public.profiles TO authenticated;
