import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(
    configuredUrl &&
    anonKey &&
    !configuredUrl.includes('placeholder') &&
    !configuredUrl.includes('your-project') &&
    !anonKey.includes('placeholder') &&
    !anonKey.includes('your-anon')
  )
}

function getSupabaseUrl(): string {
  if (!isSupabaseConfigured() || !configuredUrl || !anonKey) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  let url: URL
  try {
    url = new URL(configuredUrl)
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid Supabase project URL.')
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('VITE_SUPABASE_URL must use HTTPS.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_SUPABASE_URL must be the project URL without credentials, query parameters, or fragments.')
  }

  if (/\/rest\/v1\/?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/rest\/v1\/?$/i, '') || '/'
    console.warn('VITE_SUPABASE_URL included /rest/v1; using the Supabase project root. Update the environment variable.')
  }

  return url.toString().replace(/\/+$/, '')
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!anonKey) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    }
    client = createClient(getSupabaseUrl(), anonKey)
  }

  return client
}
