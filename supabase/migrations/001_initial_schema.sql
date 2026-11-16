-- ============================================================
-- StockFlow Pro - Initial Schema Migration
-- Version: 001
-- Description: Full schema for inventory management system
--              (pipes & fittings wholesale company)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== ENUMS ====================
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'staff');
CREATE TYPE product_unit AS ENUM ('piece', 'coil', 'metre', 'tank', 'box', 'kg', 'litre');
CREATE TYPE movement_type AS ENUM ('inward', 'outward', 'return', 'transfer_in', 'transfer_out', 'adjustment', 'opening');
CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'posted');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'correction_requested');
CREATE TYPE audit_result AS ENUM ('success', 'failure');
CREATE TYPE count_line_status AS ENUM ('matched', 'discrepancy', 'approved', 'rejected');

-- ==================== PROFILES ====================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'staff',
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  warehouse_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== WAREHOUSES ====================
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from profiles to warehouses AFTER warehouses created
ALTER TABLE profiles ADD CONSTRAINT profiles_warehouse_id_fkey
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;

-- ==================== CATEGORIES ====================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== PRODUCTS ====================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  grade TEXT,
  diameter_mm NUMERIC(10,2),
  pressure_rating_kg NUMERIC(10,2),
  weight_kg NUMERIC(10,3),
  coil_length_m NUMERIC(10,2),
  unit product_unit NOT NULL DEFAULT 'piece',
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(5,2) NOT NULL DEFAULT 18,
  min_stock_threshold NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== STOCK BALANCES ====================
CREATE TABLE stock_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, warehouse_id)
);

-- ==================== STOCK MOVEMENTS ====================
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_no TEXT NOT NULL UNIQUE,
  movement_type movement_type NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  dest_warehouse_id UUID REFERENCES warehouses(id),
  quantity NUMERIC(14,3) NOT NULL,
  unit_rate NUMERIC(12,2),
  challan_no TEXT,
  supplier_customer TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  report_line_id UUID,
  status report_status NOT NULL DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== DAILY STOCK REPORTS ====================
CREATE TABLE daily_stock_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_date DATE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  status report_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_date, warehouse_id, created_by)
);

CREATE TABLE daily_stock_report_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES daily_stock_reports(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  opening_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  inward_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  outward_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  closing_stock NUMERIC(14,3) GENERATED ALWAYS AS (opening_stock + inward_qty - outward_qty) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, product_id)
);

-- Add FK from stock_movements to report_lines
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_report_line_id_fkey
  FOREIGN KEY (report_line_id) REFERENCES daily_stock_report_lines(id) ON DELETE SET NULL;

-- ==================== PHYSICAL COUNTS ====================
CREATE TABLE physical_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_date DATE NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  status report_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE physical_count_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_id UUID NOT NULL REFERENCES physical_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  system_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  counted_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  variance NUMERIC(14,3) GENERATED ALWAYS AS (counted_stock - system_stock) STORED,
  notes TEXT,
  status count_line_status NOT NULL DEFAULT 'discrepancy',
  UNIQUE(count_id, product_id)
);

-- ==================== APPROVALS ====================
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_no TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  warehouse_id UUID REFERENCES warehouses(id),
  summary TEXT,
  reason TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== PRICE RULES ====================
CREATE TABLE price_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  category_id UUID REFERENCES categories(id),
  rule_type TEXT NOT NULL DEFAULT 'discount',
  discount_percent NUMERIC(5,2),
  min_quantity NUMERIC(14,3),
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== AUDIT LOGS ====================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  warehouse_id UUID REFERENCES warehouses(id),
  result audit_result NOT NULL DEFAULT 'success',
  change_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== IMPORT JOBS ====================
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  inserted_rows INT NOT NULL DEFAULT 0,
  updated_rows INT NOT NULL DEFAULT 0,
  skipped_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  errors JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================== INDEXES ====================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_stock_balances_warehouse ON stock_balances(warehouse_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_created_by ON stock_movements(created_by);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_daily_reports_date ON daily_stock_reports(report_date);
CREATE INDEX idx_daily_reports_warehouse ON daily_stock_reports(warehouse_id);
CREATE INDEX idx_daily_reports_created_by ON daily_stock_reports(created_by);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ==================== UPDATED AT TRIGGER ====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_stock_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== STOCK BALANCE FUNCTION ====================
CREATE OR REPLACE FUNCTION post_stock_movement(
  p_movement_id UUID,
  p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
  v_movement stock_movements%ROWTYPE;
BEGIN
  SELECT * INTO v_movement FROM stock_movements WHERE id = p_movement_id FOR UPDATE;

  IF v_movement.status = 'posted' THEN
    RAISE EXCEPTION 'Movement already posted';
  END IF;

  -- Update or insert stock balance based on movement type
  IF v_movement.movement_type IN ('inward', 'return', 'transfer_in', 'opening') THEN
    INSERT INTO stock_balances (product_id, warehouse_id, quantity)
    VALUES (v_movement.product_id, v_movement.warehouse_id, v_movement.quantity)
    ON CONFLICT (product_id, warehouse_id) DO UPDATE
      SET quantity = stock_balances.quantity + v_movement.quantity,
          last_updated = NOW();

  ELSIF v_movement.movement_type IN ('outward', 'transfer_out') THEN
    UPDATE stock_balances
      SET quantity = quantity - v_movement.quantity,
          last_updated = NOW()
    WHERE product_id = v_movement.product_id
      AND warehouse_id = v_movement.warehouse_id;

  ELSIF v_movement.movement_type = 'adjustment' THEN
    INSERT INTO stock_balances (product_id, warehouse_id, quantity)
    VALUES (v_movement.product_id, v_movement.warehouse_id, v_movement.quantity)
    ON CONFLICT (product_id, warehouse_id) DO UPDATE
      SET quantity = v_movement.quantity,
          last_updated = NOW();
  END IF;

  -- Mark movement as posted
  UPDATE stock_movements
    SET status = 'posted', posted_at = NOW()
  WHERE id = p_movement_id;

  -- Write audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, warehouse_id, result, change_summary)
  VALUES (
    p_actor_id,
    'post_movement',
    'stock_movement',
    p_movement_id,
    v_movement.warehouse_id,
    'success',
    jsonb_build_object(
      'movement_type', v_movement.movement_type,
      'quantity',      v_movement.quantity,
      'product_id',    v_movement.product_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== ROW LEVEL SECURITY ====================
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock_reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stock_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_counts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_count_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs              ENABLE ROW LEVEL SECURITY;

-- ==================== HELPER FUNCTIONS ====================
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS UUID AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==================== RLS POLICIES: PROFILES ====================
-- Users can see their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admin / supervisor can see all profiles
CREATE POLICY "Admin/supervisor can view all profiles"
  ON profiles FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Admin has full control
CREATE POLICY "Admin can manage all profiles"
  ON profiles FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: WAREHOUSES ====================
CREATE POLICY "Authenticated users can view warehouses"
  ON warehouses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage warehouses"
  ON warehouses FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: CATEGORIES ====================
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage categories"
  ON categories FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: PRODUCTS ====================
CREATE POLICY "Authenticated users can view active products"
  ON products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage products"
  ON products FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: STOCK BALANCES ====================
CREATE POLICY "Admin/supervisor can view stock balances"
  ON stock_balances FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can view own warehouse balances"
  ON stock_balances FOR SELECT
  USING (
    warehouse_id = (SELECT warehouse_id FROM profiles WHERE user_id = auth.uid())
  );

-- ==================== RLS POLICIES: STOCK MOVEMENTS ====================
CREATE POLICY "Users can view own movements"
  ON stock_movements FOR SELECT
  USING (created_by = get_current_profile_id());

CREATE POLICY "Admin/supervisor can view all movements"
  ON stock_movements FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can create movements"
  ON stock_movements FOR INSERT
  WITH CHECK (created_by = get_current_profile_id());

CREATE POLICY "Admin can manage movements"
  ON stock_movements FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: DAILY STOCK REPORTS ====================
CREATE POLICY "Staff can view own reports"
  ON daily_stock_reports FOR SELECT
  USING (created_by = get_current_profile_id());

CREATE POLICY "Admin/supervisor can view all reports"
  ON daily_stock_reports FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can create own reports"
  ON daily_stock_reports FOR INSERT
  WITH CHECK (created_by = get_current_profile_id());

CREATE POLICY "Staff can update own draft reports"
  ON daily_stock_reports FOR UPDATE
  USING (created_by = get_current_profile_id() AND status IN ('draft', 'rejected'));

CREATE POLICY "Admin/supervisor can update any report"
  ON daily_stock_reports FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'supervisor'));

-- ==================== RLS POLICIES: DAILY STOCK REPORT LINES ====================
CREATE POLICY "Users can view lines of their reports"
  ON daily_stock_report_lines FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM daily_stock_reports WHERE created_by = get_current_profile_id()
    )
  );

CREATE POLICY "Admin/supervisor can view all lines"
  ON daily_stock_report_lines FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can insert lines to own reports"
  ON daily_stock_report_lines FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM daily_stock_reports
      WHERE created_by = get_current_profile_id()
        AND status IN ('draft', 'rejected')
    )
  );

CREATE POLICY "Staff can update lines in own draft reports"
  ON daily_stock_report_lines FOR UPDATE
  USING (
    report_id IN (
      SELECT id FROM daily_stock_reports
      WHERE created_by = get_current_profile_id()
        AND status IN ('draft', 'rejected')
    )
  );

-- ==================== RLS POLICIES: PHYSICAL COUNTS ====================
CREATE POLICY "Staff can view own physical counts"
  ON physical_counts FOR SELECT
  USING (created_by = get_current_profile_id());

CREATE POLICY "Admin/supervisor can view all counts"
  ON physical_counts FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can create physical counts"
  ON physical_counts FOR INSERT
  WITH CHECK (created_by = get_current_profile_id());

CREATE POLICY "Staff can update own draft counts"
  ON physical_counts FOR UPDATE
  USING (created_by = get_current_profile_id() AND status = 'draft');

CREATE POLICY "Admin/supervisor can update counts"
  ON physical_counts FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'supervisor'));

-- ==================== RLS POLICIES: PHYSICAL COUNT LINES ====================
CREATE POLICY "Users can view own count lines"
  ON physical_count_lines FOR SELECT
  USING (
    count_id IN (
      SELECT id FROM physical_counts WHERE created_by = get_current_profile_id()
    )
  );

CREATE POLICY "Admin/supervisor can view all count lines"
  ON physical_count_lines FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can manage own draft count lines"
  ON physical_count_lines FOR ALL
  USING (
    count_id IN (
      SELECT id FROM physical_counts
      WHERE created_by = get_current_profile_id()
        AND status = 'draft'
    )
  );

-- ==================== RLS POLICIES: APPROVAL REQUESTS ====================
CREATE POLICY "Users can view own approval requests"
  ON approval_requests FOR SELECT
  USING (created_by = get_current_profile_id());

CREATE POLICY "Admin/supervisor can view all approvals"
  ON approval_requests FOR SELECT
  USING (get_current_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "Staff can create approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (created_by = get_current_profile_id());

CREATE POLICY "Admin/supervisor can update approvals"
  ON approval_requests FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'supervisor'));

-- ==================== RLS POLICIES: PRICE RULES ====================
CREATE POLICY "Authenticated users can view price rules"
  ON price_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin can manage price rules"
  ON price_rules FOR ALL
  USING (get_current_user_role() = 'admin');

-- ==================== RLS POLICIES: AUDIT LOGS ====================
CREATE POLICY "Admin can view audit logs"
  ON audit_logs FOR SELECT
  USING (get_current_user_role() = 'admin');

-- Allow system/SECURITY DEFINER functions to insert
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ==================== RLS POLICIES: IMPORT JOBS ====================
CREATE POLICY "Admin can manage import jobs"
  ON import_jobs FOR ALL
  USING (get_current_user_role() = 'admin');
