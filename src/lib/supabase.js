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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both required environment variables are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** Shared Supabase client, or null before credentials are configured. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
