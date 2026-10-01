import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyAuthError } from '@/lib/dbErrors'

/**
 * Admin authentication context.
 *
 * Wraps the whole /admin subtree. Exposes the Supabase session, a login
 * and a logout action, and whether Supabase is configured at all. The
 * session is loaded once and then kept current through the auth state
 * listener, so login, logout and expiry update every guard instantly.
 *
 * Being signed in is not enough: every session is verified against the
 * database through the admin_check() RPC (public.admins membership) before
 * it is admitted here. A session that fails the check is signed out again,
 * so a normal authenticated user never reaches the admin panel even though
 * the underlying Supabase project may allow other users.
 */
const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setStatus('ready')
      return undefined
    }

    let mounted = true

    /**
     * Admits a session only after the database confirms the user is a
     * Markipie admin. Non-admin sessions are signed out immediately.
     */
    const admit = async (nextSession) => {
      if (!mounted) {
        return
      }
      if (!nextSession) {
        setSession(null)
        setIsAdmin(false)
        return
      }
      try {
        const { data } = await supabase.rpc('admin_check')
        if (!mounted) {
          return
        }
        if (data === true) {
          setSession(nextSession)
          setIsAdmin(true)
          return
        }
      } catch {
        // Network or schema hiccup: fall through and reject the session.
        // The login screen stays reachable, so nothing is lost.
      }
      setSession(null)
      setIsAdmin(false)
      try {
        await supabase.auth.signOut()
      } catch {
        // Local state is already cleared; the next load re-checks.
      }
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        // Stay in the loading state until the admin verification finished:
        // guards must never see "ready with no session" while a valid
        // session is still being verified, or a hard load of a protected
        // admin URL would bounce to the login screen.
        await admit(data.session ?? null)
        if (mounted) {
          setStatus('ready')
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null)
          setIsAdmin(false)
          setStatus('ready')
        }
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      admit(nextSession ?? null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => {
    const login = async (email, password) => {
      if (!supabase) {
        return { error: { message: 'not-configured' } }
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: { message: friendlyAuthError(error), raw: error.message } }
      }
      // The account must be a Markipie admin. The auth listener verifies
      // every session too; this check gives the login form its message.
      try {
        const { data } = await supabase.rpc('admin_check')
        if (data !== true) {
          await supabase.auth.signOut()
          return {
            error: { message: 'This account does not have admin access.' },
          }
        }
      } catch {
        await supabase.auth.signOut()
        return { error: { message: 'Could not verify admin access. Try again.' } }
      }
      return { error: null }
    }

    const logout = async () => {
      if (!supabase) {
        return
      }
      try {
        await supabase.auth.signOut()
      } catch {
        // Signing out locally still clears the session listener side.
        setSession(null)
        setIsAdmin(false)
      }
    }

    return {
      configured: isSupabaseConfigured,
      status,
      session,
      isAdmin,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.user),
      login,
      logout,
    }
  }, [status, session, isAdmin])

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  }
  return context
}
