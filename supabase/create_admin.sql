-- ============================================================
-- StockFlow Pro — Create First Admin User
-- ============================================================
-- Prerequisites:
--   1. Create a user through the Supabase Auth dashboard:
--      Dashboard → Authentication → Users → "Add user"
--      (or via the Supabase CLI / Management API)
--   2. Copy the UUID that Supabase generated for that user.
--   3. Paste it below in place of REPLACE_WITH_ACTUAL_AUTH_USER_ID.
--   4. Run this script in the Supabase SQL editor.
-- ============================================================

INSERT INTO profiles (
  user_id,
  full_name,
  username,
  role,
  is_active,
  permissions
)
VALUES (
  'REPLACE_WITH_ACTUAL_AUTH_USER_ID',   -- UUID from auth.users
  'Admin User',
  'admin',
  'admin',
  true,
  '{"can_approve": true, "can_export": true, "can_import": true}'
);

-- ============================================================
-- To create additional staff / supervisor accounts later:
-- ============================================================
-- INSERT INTO profiles (user_id, full_name, username, role, warehouse_id, is_active, permissions)
-- VALUES (
--   'REPLACE_WITH_AUTH_USER_ID',
--   'Staff Name',
--   'staff_username',
--   'staff',                       -- or 'supervisor'
--   'REPLACE_WITH_WAREHOUSE_UUID', -- optional: assign to a warehouse
--   true,
--   '{}'
-- );
