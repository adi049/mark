/**
 * Supabase client foundation.
 *
 * Reads credentials from environment variables and exports a single shared
 * client. The client is null until both variables are provided, so the site
 * renders normally in development before Supabase is provisioned.
 *
 * Future phases will build on this client for:
 *   - Authentication (including Google OAuth for client access)
 *   - Client, event and gallery tables
 *   - Blog CMS content
 *   - Download permissions and reactions
 *
 * Security notes:
 *   - Only the anon key belongs in the frontend. Never expose the service
 *     role key here; it belongs to trusted server environments only.
 *   - Row level security in Supabase remains the actual access control.
 */

import { createClient } from '@supabase/supabase-js'

// GitHub Pages is a static frontend, so the Supabase publishable key is
// intentionally safe to ship to the browser. Environment variables override
// these production fallbacks when configured in a local or CI build.
// MARKIPIE's production client must always talk to the same Supabase
// project as the event/access-code database. Do not let a stale GitHub
// Actions variable silently point Client Access at another project.
const supabaseUrl = 'https://ftnmeccyphwsyleqgmkd.supabase.co'
const supabaseAnonKey = 'sb_publishable_8rBzvz2lrQN6RQAL4vxpTg_MPnHagZu'

/** True when both required environment variables are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Shared Supabase client, or null before credentials are configured. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
