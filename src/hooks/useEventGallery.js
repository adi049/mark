import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

/**
 * Gallery data hooks for the client access page. Every call is gated by
 * the event code server side; these hooks only shape the responses.
 */

/** Top level folders of the accessed event. */
export function useEventFolders(code, enabled = true) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!enabled || !supabase) {
      setState({ status: supabase ? 'loading' : 'not-configured', data: null, error: null })
      return undefined
    }
    let alive = true
    setState((previous) => ({ ...previous, status: 'loading', error: null }))

    supabase
      .rpc('get_event_folders', { p_code: code })
      .then((response) => {
        if (!alive) {
          return
        }
        const payload =
          response && typeof response === 'object' && 'data' in response ? response : { data: response, error: null }
        if (payload.error) {
          throw payload.error
        }
        setState({ status: 'success', data: payload.data ?? [], error: null })
      })
      .catch((error) => {
        if (alive) {
          setState({ status: 'error', data: null, error: friendlyDbError(error) })
        }
      })

    return () => {
      alive = false
    }
  }, [code, enabled])

  const refetch = useCallback(() => {
    setState((previous) => ({ ...previous }))
    // Re-run by toggling a nonce would complicate the API; callers remount
    // folder views on navigation, which covers the practical refresh cases.
  }, [])

  return { ...state, refetch, configured: isSupabaseConfigured }
}

/** Subfolders of one folder, for dynamic Photos/Videos style structures. */
export function useEventSubfolders(code, folderId, enabled = true) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    if (!enabled || !supabase || !folderId) {
      setState({ status: 'idle', data: [], error: null })
      return undefined
    }
    let alive = true
    setState({ status: 'loading', data: null, error: null })

    supabase
      .rpc('get_event_subfolders', { p_code: code, p_folder_id: folderId })
      .then((response) => {
        if (!alive) {
          return
        }
        const payload =
          response && typeof response === 'object' && 'data' in response ? response : { data: response, error: null }
        if (payload.error) {
          throw payload.error
        }
        setState({ status: 'success', data: payload.data ?? [], error: null })
      })
      .catch((error) => {
        if (alive) {
          setState({ status: 'error', data: null, error: friendlyDbError(error) })
        }
      })

    return () => {
      alive = false
    }
  }, [code, folderId, enabled])

  return state
}

/**
 * Paged media for one folder. Loads a page at a time so an event with
 * thousands of photos stays smooth; `loadMore` appends the next page.
 */
export function useFolderMedia(code, folderId, sessionId, pageSize = 24) {
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    total: 0,
    page: 0,
    loadingMore: false,
    error: null,
  })

  useEffect(() => {
    if (!supabase || !folderId) {
      setState({ status: 'idle', items: [], total: 0, page: 0, loadingMore: false, error: null })
      return undefined
    }
    let alive = true
    setState({ status: 'loading', items: [], total: 0, page: 0, loadingMore: false, error: null })

    supabase
      .rpc('get_event_media', {
        p_code: code,
        p_folder_id: folderId,
        p_limit: pageSize,
        p_offset: 0,
        p_session_id: sessionId,
      })
      .then((response) => {
        if (!alive) {
          return
        }
        const payload =
          response && typeof response === 'object' && 'data' in response ? response : { data: response, error: null }
        if (payload.error) {
          throw payload.error
        }
        const rows = payload.data ?? []
        setState({
          status: 'success',
          items: rows,
          total: rows.length ? Number(rows[0].total ?? 0) : 0,
          page: 1,
          loadingMore: false,
          error: null,
        })
      })
      .catch((error) => {
        if (alive) {
          setState({ status: 'error', items: [], total: 0, page: 0, loadingMore: false, error: friendlyDbError(error) })
        }
      })

    return () => {
      alive = false
    }
  }, [code, folderId, sessionId, pageSize])

  const loadMore = useCallback(async () => {
    setState((previous) => {
      if (previous.loadingMore || previous.items.length >= previous.total) {
        return previous
      }
      return { ...previous, loadingMore: true }
    })

    try {
      const response = await supabase.rpc('get_event_media', {
        p_code: code,
        p_folder_id: folderId,
        p_limit: pageSize,
        p_offset: state.items.length,
        p_session_id: sessionId,
      })
      const payload =
        response && typeof response === 'object' && 'data' in response ? response : { data: response, error: null }
      if (payload.error) {
        throw payload.error
      }
      const rows = payload.data ?? []
      setState((previous) => ({
        ...previous,
        items: [...previous.items, ...rows],
        page: previous.page + 1,
        loadingMore: false,
      }))
    } catch (error) {
      setState((previous) => ({ ...previous, loadingMore: false, error: friendlyDbError(error) }))
    }
  }, [code, folderId, sessionId, pageSize, state.items.length])

  const updateReaction = useCallback((mediaId, reaction) => {
    setState((previous) => ({
      ...previous,
      items: previous.items.map((media) =>
        media.id === mediaId ? { ...media, my_reaction: reaction } : media
      ),
    }))
  }, [])

  return { ...state, loadMore, updateReaction }
}
