import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { hydrateCatalogCacheFromSupabase } from '../lib/dataService'
import type { Profile } from '../types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Profile['role'] | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const fetchProfile = useCallback(async (userId: string): Promise<Profile> => {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw new Error(`Unable to load your profile: ${error.message}`)
    if (!data) throw new Error('No profile is configured for this authentication user.')

    const profileData = data as Profile
    // Refresh shared catalog data before rendering staff pages that use the
    // synchronous legacy repository helpers. Keep login available if a table
    // is misconfigured, but make the actual database failure visible in Console.
    try {
      await hydrateCatalogCacheFromSupabase()
    } catch (catalogError) {
      console.error('[StockFlow] Failed to load shared inventory data:', catalogError)
    }
    setProfile(profileData)
    setAuthError(null)
    return profileData
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null)
      return
    }

    await fetchProfile(user.id)
  }, [user, fetchProfile])

  // Keep the local compatibility cache refreshed when another signed-in user
  // changes shared catalog or operational rows. Existing screens read this cache.
  useEffect(() => {
    if (!user || !profile || !isSupabaseConfigured()) return
    let refreshInProgress = false
    const channel = getSupabase().channel(`stockflow-shared-${user.id}`)
    const tables = [
      'categories', 'warehouses', 'products', 'stock_balances', 'stock_movements',
      'inward_stock_entries', 'inward_stock_lines', 'outward_deliveries', 'delivery_items'
    ]
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (refreshInProgress) return
        refreshInProgress = true
        void hydrateCatalogCacheFromSupabase()
          .then(() => window.dispatchEvent(new Event('stockflow:data-updated')))
          .catch(error => console.error('[StockFlow] Realtime refresh failed:', error))
          .finally(() => { refreshInProgress = false })
      })
    }
    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[StockFlow] Realtime subscription status:', status)
      }
    })
    return () => { void getSupabase().removeChannel(channel) }
  }, [user, profile])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    let active = true
    const loadSession = async () => {
      const { data, error } = await getSupabase().auth.getSession()
      if (error) throw error
      if (!active) return

      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      if (sessionUser) await fetchProfile(sessionUser.id)
      else setProfile(null)
    }

    void loadSession()
      .catch(error => {
        if (active) {
          setProfile(null)
          setAuthError(error instanceof Error ? error.message : 'Unable to restore the authentication session.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      if (!sessionUser) {
        setProfile(null)
        setAuthError(null)
        return
      }

      window.setTimeout(() => {
        void fetchProfile(sessionUser.id).catch(error => {
          setProfile(null)
          setAuthError(error instanceof Error ? error.message : 'Unable to load your profile.')
        })
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role: Profile['role'] | null }> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.', role: null }
    }

    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) return { error: error.message, role: null }

    try {
      const signedInProfile = await fetchProfile(data.user.id)
      setAuthError(null)
      return { error: null, role: signedInProfile.role }
    } catch (profileError) {
      const message = profileError instanceof Error ? profileError.message : 'Unable to load your profile.'
      const { error: signOutError } = await getSupabase().auth.signOut()
      if (signOutError) {
        const signOutMessage = `${message} The session could not be cleared: ${signOutError.message}`
        setAuthError(signOutMessage)
        return { error: signOutMessage, role: null }
      }
      setUser(null)
      setProfile(null)
      setAuthError(message)
      return { error: message, role: null }
    }
  }

  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut()
    if (error) throw new Error(`Unable to sign out: ${error.message}`)
    setUser(null)
    setProfile(null)
    setAuthError(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
