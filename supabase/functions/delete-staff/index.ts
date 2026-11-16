import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration is incomplete' }, 500)
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401)
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: caller, error: callerError } =
    await authClient.auth.getUser(authorization.slice('Bearer '.length))
  if (callerError || !caller.user) {
    return jsonResponse({ error: 'Invalid or expired login session' }, 401)
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: adminProfile, error: adminError } = await adminClient
    .from('profiles')
    .select('role, is_active')
    .eq('user_id', caller.user.id)
    .maybeSingle()

  if (adminError || !adminProfile || adminProfile.role !== 'admin' || adminProfile.is_active !== true) {
    return jsonResponse({ error: 'Administrator permission required' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body' }, 400)
  }

  const userId = typeof body.user_id === 'string' ? body.user_id : ''
  if (!userId) return jsonResponse({ error: 'user_id is required' }, 400)
  if (userId === caller.user.id) {
    return jsonResponse({ error: 'You cannot delete your own administrator account' }, 400)
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (targetError) return jsonResponse({ error: 'Could not load employee profile' }, 500)
  if (!target) return jsonResponse({ error: 'Employee profile not found' }, 404)
  if (target.role === 'admin') {
    return jsonResponse({ error: 'Administrator accounts cannot be deleted from this screen' }, 403)
  }

  // Delete the profile first, then the Auth user. Restore the profile if Auth deletion fails.
  const { error: profileDeleteError } = await adminClient
    .from('profiles')
    .delete()
    .eq('user_id', userId)

  if (profileDeleteError) {
    return jsonResponse({ error: 'Could not delete employee profile' }, 500)
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (authDeleteError) {
    const { error: restoreError } = await adminClient.from('profiles').insert(target)
    if (restoreError) console.error('Profile restoration failed after Auth deletion error')
    return jsonResponse({ error: 'Could not delete employee login. Check related database records and try again.' }, 500)
  }

  return jsonResponse({ success: true, message: 'Employee login and profile deleted successfully' })
})
