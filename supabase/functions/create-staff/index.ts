import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedRoles = [
  'admin',
  'supervisor',
  'staff',
  'manager',
  'driver',
  'cleaner',
  'other',
] as const

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration is incomplete' }, 500)
  }

  const authorization = req.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const token = authorization.slice('Bearer '.length)

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token)

  if (authError || !authData.user) {
    return jsonResponse({ error: 'Invalid or expired login session' }, 401)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  // Only an active administrator may create employee accounts.
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    callerProfile.is_active !== true
  ) {
    return jsonResponse({ error: 'Administrator permission required' }, 403)
  }

  let body: Record<string, unknown>

  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400)
  }

  const fullName =
    typeof body.full_name === 'string' ? body.full_name.trim() : ''
  const username =
    typeof body.username === 'string'
      ? body.username.trim().toLowerCase()
      : ''
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const role = typeof body.role === 'string' ? body.role : 'staff'

  if (!fullName || !username || !email || !password) {
    return jsonResponse({
      error: 'Full name, username, email, and password are required',
    }, 400)
  }

  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return jsonResponse({
      error: 'Username must be 3–30 characters using letters, numbers, dots, underscores, or hyphens',
    }, 400)
  }

  if (password.length < 8) {
    return jsonResponse({
      error: 'Password must contain at least 8 characters',
    }, 400)
  }

  if (password.length > 128) {
    return jsonResponse({ error: 'Password is too long' }, 400)
  }

  if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
    return jsonResponse({ error: 'Invalid employee role' }, 400)
  }

  const warehouseId =
    typeof body.warehouse_id === 'string' && body.warehouse_id
      ? body.warehouse_id
      : null

  if (warehouseId) {
    const { data: warehouse, error: warehouseError } = await adminClient
      .from('warehouses')
      .select('id')
      .eq('id', warehouseId)
      .maybeSingle()

    if (warehouseError || !warehouse) {
      return jsonResponse({ error: 'Selected warehouse does not exist' }, 400)
    }
  }

  const { data: existingUsername, error: usernameCheckError } =
    await adminClient
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

  if (usernameCheckError) {
    return jsonResponse({ error: 'Could not validate username' }, 500)
  }

  if (existingUsername) {
    return jsonResponse({ error: 'Username is already in use' }, 409)
  }

  const permissions = {
    can_approve: ['admin', 'manager', 'supervisor'].includes(role),
    can_export: ['admin', 'manager', 'supervisor'].includes(role),
    can_import: ['admin', 'manager'].includes(role),
    can_manage_rates: ['admin', 'manager'].includes(role),
    can_manage_users: role === 'admin',
  }

  // Create the actual Supabase Authentication account.
  const { data: createdAuth, error: createAuthError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        username,
      },
    })

  if (createAuthError || !createdAuth.user) {
    return jsonResponse({
      error: createAuthError?.message || 'Could not create login account',
    }, 400)
  }

  const authUserId = createdAuth.user.id

  // Link the profile to the real Auth UUID.
  const { error: insertProfileError } = await adminClient
    .from('profiles')
    .insert({
      user_id: authUserId,
      full_name: fullName,
      username,
      role,
      email,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      warehouse_id: warehouseId,
      employee_id:
        typeof body.employee_id === 'string'
          ? body.employee_id.trim() || null
          : null,
      address:
        typeof body.address === 'string'
          ? body.address.trim() || null
          : null,
      avatar_url: null,
      is_active: body.is_active === false ? false : true,
      permissions,
    })

  if (insertProfileError) {
    // Avoid leaving an orphaned Auth account if the profile insert fails.
    const { error: rollbackError } =
      await adminClient.auth.admin.deleteUser(authUserId)

    if (rollbackError) {
      console.error('Account cleanup failed after profile insert error')
    }

    console.error('Profile insert failed:', insertProfileError.message)

    return jsonResponse({
      error: 'Profile creation failed. Check the database constraints and server logs.',
    }, 500)
  }

  return jsonResponse({
    success: true,
    user_id: authUserId,
    message: 'Employee login and profile created successfully',
  }, 201)
})