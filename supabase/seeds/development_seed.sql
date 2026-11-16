-- ============================================================
-- StockFlow Pro - Seed Data
-- Version: 002
-- Description: Initial reference data: warehouses, categories,
--              and products (Indian market, pipes & fittings)
-- ============================================================
-- DEVELOPMENT ONLY. This file is intentionally outside migrations and is never
-- applied by `supabase db push`. Review all records before manual execution.
-- Do not run against production or a database containing business data.
-- NOTE: Auth users are NOT created here.
-- Create users through the Supabase Auth dashboard or API,
-- then run create_admin.sql (or equivalent) to insert their
-- profile record.  See supabase/README.md for the full guide.
-- ============================================================

-- ==================== WAREHOUSES ====================
INSERT INTO warehouses (id, name, code, address, city, is_active) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Main Office',  'MO',  'Plot 12, Industrial Estate, Ring Road',       'Ahmedabad', true),
  ('11111111-0000-0000-0000-000000000002', 'Godown 1',     'GD1', 'Shed A, Phase-II, GIDC, Vatva',              'Ahmedabad', true),
  ('11111111-0000-0000-0000-000000000003', 'Godown 2',     'GD2', 'Shed C-7, Naroda Industrial Area',           'Ahmedabad', true),
  ('11111111-0000-0000-0000-000000000004', 'Godown 3',     'GD3', 'Survey No. 45, Odhav Road, Ramol',           'Ahmedabad', true);

-- ==================== CATEGORIES ====================
INSERT INTO categories (id, name, code, description, is_active, sort_order) VALUES
  ('22222222-0000-0000-0000-000000000001', 'PVC Pipes',     'PVC',  'Rigid PVC pressure pipes (IS 4985)',              true, 1),
  ('22222222-0000-0000-0000-000000000002', 'HDPE Pipes',    'HDPE', 'High Density Polyethylene pipes (IS 4984)',        true, 2),
  ('22222222-0000-0000-0000-000000000003', 'SWR Pipes',     'SWR',  'Soil Waste & Rain water PVC pipes (IS 13592)',    true, 3),
  ('22222222-0000-0000-0000-000000000004', 'CPVC Pipes',    'CPVC', 'Chlorinated PVC hot & cold water pipes (IS 15778)',true, 4),
  ('22222222-0000-0000-0000-000000000005', 'Pipe Fittings', 'FIT',  'PVC/CPVC/HDPE fittings — elbows, tees, couplings',true, 5),
  ('22222222-0000-0000-0000-000000000006', 'Water Tanks',   'TANK', 'Triple-layer LLDPE water storage tanks',          true, 6);

-- ==================== PRODUCTS ====================

-- ---- PVC Pipes ----
INSERT INTO products (sku, name, category_id, grade, diameter_mm, pressure_rating_kg, weight_kg, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('PVC-63-4',  'PVC Pipe 63mm 4kg',  '22222222-0000-0000-0000-000000000001', 'ISI', 63.0,  4.0, 1.950, 'piece', 285.00, 18, 50,  'IS 4985, 3-metre length, blue colour'),
  ('PVC-75-4',  'PVC Pipe 75mm 4kg',  '22222222-0000-0000-0000-000000000001', 'ISI', 75.0,  4.0, 2.650, 'piece', 395.00, 18, 50,  'IS 4985, 3-metre length'),
  ('PVC-90-4',  'PVC Pipe 90mm 4kg',  '22222222-0000-0000-0000-000000000001', 'ISI', 90.0,  4.0, 3.600, 'piece', 530.00, 18, 30,  'IS 4985, 3-metre length'),
  ('PVC-110-4', 'PVC Pipe 110mm 4kg', '22222222-0000-0000-0000-000000000001', 'ISI', 110.0, 4.0, 5.350, 'piece', 785.00, 18, 20,  'IS 4985, 3-metre length'),
  ('PVC-160-4', 'PVC Pipe 160mm 4kg', '22222222-0000-0000-0000-000000000001', 'ISI', 160.0, 4.0, 11.20, 'piece',1650.00, 18, 10,  'IS 4985, 3-metre length');

-- ---- HDPE Pipes (PE80, sold by coil) ----
INSERT INTO products (sku, name, category_id, grade, diameter_mm, pressure_rating_kg, weight_kg, coil_length_m, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('HDPE-32-8',  'HDPE PE80 Pipe 32mm 8kg 500m',  '22222222-0000-0000-0000-000000000002', 'PE80', 32.0,  8.0,  60.0, 500.0, 'coil',  4800.00, 18, 5, 'IS 4984, black with blue stripe'),
  ('HDPE-50-8',  'HDPE PE80 Pipe 50mm 8kg 300m',  '22222222-0000-0000-0000-000000000002', 'PE80', 50.0,  8.0,  90.0, 300.0, 'coil',  9500.00, 18, 5, 'IS 4984'),
  ('HDPE-63-8',  'HDPE PE80 Pipe 63mm 8kg 200m',  '22222222-0000-0000-0000-000000000002', 'PE80', 63.0,  8.0, 108.0, 200.0, 'coil', 13500.00, 18, 3, 'IS 4984'),
  ('HDPE-90-8',  'HDPE PE80 Pipe 90mm 8kg 100m',  '22222222-0000-0000-0000-000000000002', 'PE80', 90.0,  8.0, 110.0, 100.0, 'coil', 17800.00, 18, 3, 'IS 4984'),
  ('HDPE-110-8', 'HDPE PE80 Pipe 110mm 8kg 100m', '22222222-0000-0000-0000-000000000002', 'PE80', 110.0, 8.0, 160.0, 100.0, 'coil', 26500.00, 18, 2, 'IS 4984');

-- ---- SWR Pipes ----
INSERT INTO products (sku, name, category_id, grade, diameter_mm, weight_kg, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('SWR-75',  'SWR Pipe 75mm',  '22222222-0000-0000-0000-000000000003', 'SWR', 75.0,  1.300, 'piece', 195.00, 18, 30, 'IS 13592, 3-metre length, grey'),
  ('SWR-110', 'SWR Pipe 110mm', '22222222-0000-0000-0000-000000000003', 'SWR', 110.0, 2.100, 'piece', 310.00, 18, 30, 'IS 13592, 3-metre length'),
  ('SWR-160', 'SWR Pipe 160mm', '22222222-0000-0000-0000-000000000003', 'SWR', 160.0, 4.350, 'piece', 620.00, 18, 20, 'IS 13592, 3-metre length'),
  ('SWR-200', 'SWR Pipe 200mm', '22222222-0000-0000-0000-000000000003', 'SWR', 200.0, 6.750, 'piece', 980.00, 18, 10, 'IS 13592, 3-metre length'),
  ('SWR-250', 'SWR Pipe 250mm', '22222222-0000-0000-0000-000000000003', 'SWR', 250.0, 9.800, 'piece',1480.00, 18,  5, 'IS 13592, 3-metre length');

-- ---- CPVC Pipes (hot & cold water) ----
INSERT INTO products (sku, name, category_id, grade, diameter_mm, pressure_rating_kg, weight_kg, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('CPVC-15', 'CPVC Pipe 15mm (1/2")',  '22222222-0000-0000-0000-000000000004', 'SDR11', 15.0, 25.0, 0.180, 'piece', 85.00,  18, 100, 'IS 15778, 3-metre length, cream colour'),
  ('CPVC-20', 'CPVC Pipe 20mm (3/4")',  '22222222-0000-0000-0000-000000000004', 'SDR11', 20.0, 25.0, 0.300, 'piece', 135.00, 18, 100, 'IS 15778, 3-metre length'),
  ('CPVC-25', 'CPVC Pipe 25mm (1")',    '22222222-0000-0000-0000-000000000004', 'SDR11', 25.0, 25.0, 0.470, 'piece', 210.00, 18,  50, 'IS 15778, 3-metre length'),
  ('CPVC-32', 'CPVC Pipe 32mm (1.25")', '22222222-0000-0000-0000-000000000004', 'SDR11', 32.0, 25.0, 0.730, 'piece', 330.00, 18,  50, 'IS 15778, 3-metre length'),
  ('CPVC-40', 'CPVC Pipe 40mm (1.5")',  '22222222-0000-0000-0000-000000000004', 'SDR11', 40.0, 25.0, 1.050, 'piece', 490.00, 18,  30, 'IS 15778, 3-metre length');

-- ---- Pipe Fittings ----
INSERT INTO products (sku, name, category_id, grade, diameter_mm, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('FIT-PVC-ELB-63',   'PVC Elbow 90° 63mm',       '22222222-0000-0000-0000-000000000005', 'ISI', 63.0,  'piece',  48.00, 18, 50, 'PVC pressure fitting, ISI marked'),
  ('FIT-PVC-ELB-90',   'PVC Elbow 90° 90mm',       '22222222-0000-0000-0000-000000000005', 'ISI', 90.0,  'piece',  95.00, 18, 30, 'PVC pressure fitting'),
  ('FIT-PVC-TEE-63',   'PVC Equal Tee 63mm',        '22222222-0000-0000-0000-000000000005', 'ISI', 63.0,  'piece',  65.00, 18, 50, 'PVC pressure fitting'),
  ('FIT-PVC-TEE-90',   'PVC Equal Tee 90mm',        '22222222-0000-0000-0000-000000000005', 'ISI', 90.0,  'piece', 130.00, 18, 30, 'PVC pressure fitting'),
  ('FIT-PVC-COU-63',   'PVC Coupling 63mm',         '22222222-0000-0000-0000-000000000005', 'ISI', 63.0,  'piece',  28.00, 18, 50, 'PVC pressure fitting'),
  ('FIT-PVC-COU-90',   'PVC Coupling 90mm',         '22222222-0000-0000-0000-000000000005', 'ISI', 90.0,  'piece',  58.00, 18, 30, 'PVC pressure fitting'),
  ('FIT-CPVC-ELB-20',  'CPVC Elbow 90° 20mm',      '22222222-0000-0000-0000-000000000005', 'SDR11', 20.0, 'piece', 32.00, 18, 80, 'CPVC hot/cold water fitting'),
  ('FIT-CPVC-TEE-20',  'CPVC Equal Tee 20mm',       '22222222-0000-0000-0000-000000000005', 'SDR11', 20.0, 'piece', 45.00, 18, 80, 'CPVC hot/cold water fitting'),
  ('FIT-SWR-ELB-110',  'SWR Elbow 87.5° 110mm',    '22222222-0000-0000-0000-000000000005', 'SWR',  110.0, 'piece', 72.00, 18, 30, 'SWR drainage fitting'),
  ('FIT-SWR-TEE-110',  'SWR Equal Tee 110mm',       '22222222-0000-0000-0000-000000000005', 'SWR',  110.0, 'piece', 95.00, 18, 30, 'SWR drainage fitting');

-- ---- Water Tanks (LLDPE triple layer) ----
INSERT INTO products (sku, name, category_id, grade, weight_kg, unit, rate, gst_percent, min_stock_threshold, notes) VALUES
  ('TANK-500L',  'Water Tank 500 Litre',  '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 11.0, 'tank',  1850.00, 18, 5, 'Triple-layer LLDPE, ISI marked, food-grade'),
  ('TANK-1000L', 'Water Tank 1000 Litre', '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 20.0, 'tank',  3350.00, 18, 5, 'Triple-layer LLDPE, ISI marked, food-grade'),
  ('TANK-1500L', 'Water Tank 1500 Litre', '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 29.0, 'tank',  4850.00, 18, 3, 'Triple-layer LLDPE, ISI marked, food-grade'),
  ('TANK-2000L', 'Water Tank 2000 Litre', '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 38.0, 'tank',  6200.00, 18, 2, 'Triple-layer LLDPE, ISI marked, food-grade'),
  ('TANK-3000L', 'Water Tank 3000 Litre', '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 55.0, 'tank',  9100.00, 18, 1, 'Triple-layer LLDPE, ISI marked, food-grade'),
  ('TANK-5000L', 'Water Tank 5000 Litre', '22222222-0000-0000-0000-000000000006', 'LLDPE-TL', 88.0, 'tank', 14500.00, 18, 1, 'Triple-layer LLDPE, ISI marked, food-grade');
