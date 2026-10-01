/**
 * Access code and event token generation.
 *
 * Codes use a 32 character alphabet without easily confused characters
 * (no 0/O, 1/I/L) and draw from crypto randomness, so they cannot be
 * predicted from sequence or timing. Uniqueness is re-checked against
 * the database before every insert; the columns are also unique-indexed
 * as the final guarantee.
 */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

/** Client and event access code, for example MP-7KQ4TZ. */
export function generateAccessCode(prefix = 'MP') {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let body = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return `${prefix}-${body}`
}

/** Opaque token used inside QR links, 32 hex characters. */
export function generateEventToken() {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return generateAccessCode('EVT') + generateAccessCode().slice(3)
}

/**
 * Produces a code that does not collide with existing rows. Retries a
 * few times with fresh randomness, then returns null for the caller to
 * surface a clean error (the database unique index remains the source
 * of truth).
 */
export async function generateUniqueCode(table, column, supabase, prefix = 'MP') {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateAccessCode(prefix)
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq(column, candidate)
      .limit(1)
      .maybeSingle()
    if (error) {
      throw error
    }
    if (!data) {
      return candidate
    }
  }
  return null
}
