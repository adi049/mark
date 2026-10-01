import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

/**
 * Shared Supabase query hook for admin and public pages.
 *
 *   const { status, data, error, refetch, configured } = useSupabaseQuery(
 *     (client) => client.from('blogs').select('*'),
 *     [],
 *   )
 *
 * `run` receives the shared client and returns a builder promise. Status
 * is one of:
 *   loading        request in flight
 *   success        data ready (may be an empty array)
 *   error          request failed, error holds a friendly message
 *   not-configured Supabase env vars are absent, nothing was requested
 *
 * `deps` controls when the query re-runs; `refetch` forces a re-run.
 */
export function useSupabaseQuery(run, deps = []) {
  const [state, setState] = useState({
    status: supabase ? 'loading' : 'not-configured',
    data: null,
    error: null,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!supabase) {
      setState({ status: 'not-configured', data: null, error: null })
      return undefined
    }

    let alive = true
    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    run(supabase)
      .then((result) => {
        if (!alive) {
          return
        }
        // Queries that return a PostgREST builder resolve to a response
        // object ({ data, error, ... }); helper functions resolve to plain
        // values. Unwrap the builder shape here so callers always get data.
        const isResponse =
          result && typeof result === 'object' && 'data' in result && 'error' in result
        const payload = isResponse ? result : { data: result, error: null }
        if (payload.error) {
          throw payload.error
        }
        setState({ status: 'success', data: payload.data, error: null })
      })
      .catch((error) => {
        if (alive) {
          setState({ status: 'error', data: null, error: friendlyDbError(error) })
        }
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const refetch = useCallback(() => setNonce((value) => value + 1), [])

  return {
    ...state,
    configured: isSupabaseConfigured,
    refetch,
  }
}
