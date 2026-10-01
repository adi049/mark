/**
 * Translates Supabase and network errors into short, human readable
 * messages. Raw driver errors never reach the interface unchanged.
 */

const AUTH_MESSAGES = {
  'invalid login credentials': 'That email and password combination did not work.',
  'email not confirmed': 'This account has not been confirmed yet. Confirm the email in Supabase first.',
  'user not found': 'That email and password combination did not work.',
  'invalid request': 'Please enter a valid email address and password.',
}

const DB_MESSAGES = {
  '23505': 'That record already exists. Try a different code, slug or title.',
  '23503': 'A related record is missing, or this record is still referenced elsewhere.',
  '42501': 'You do not have permission to do that.',
  'PGRST116': 'Not found.',
}

/** Friendly message for authentication errors. */
export function friendlyAuthError(error) {
  if (!error) {
    return 'Something went wrong. Please try again.'
  }
  const raw = String(error.message || error.error_description || error.msg || '')
  const key = raw.toLowerCase()
  for (const [needle, message] of Object.entries(AUTH_MESSAGES)) {
    if (key.includes(needle)) {
      return message
    }
  }
  if (key.includes('failed to fetch') || key.includes('networkrequest failed') || key.includes('network error')) {
    return 'Could not reach the sign in service. Check your connection and try again.'
  }
  return 'Sign in failed. Please try again.'
}

/** Friendly message for database and data errors. */
export function friendlyDbError(error) {
  if (!error) {
    return 'Something went wrong. Please try again.'
  }
  const code = error.code
  if (code && DB_MESSAGES[code]) {
    return DB_MESSAGES[code]
  }
  const raw = String(error.message || '')
  const key = raw.toLowerCase()
  if (key.includes('failed to fetch') || key.includes('networkrequest failed') || key.includes('network error')) {
    return 'Could not reach the database. Check your connection and try again.'
  }
  if (key.includes('jwt') || key.includes('token') || key.includes('permission')) {
    return 'Your session expired. Sign in again.'
  }
  return 'The request could not be completed. Please try again.'
}
