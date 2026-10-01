/**
 * Client gallery session.
 *
 * After a valid event code is entered, the code (never the database id)
 * and the public event info are kept in sessionStorage so the client can
 * move between folders and media without re-entering the code. Closing
 * the tab ends the session; nothing sensitive is stored permanently.
 *
 * The session is short lived: after SESSION_TTL_MS it is discarded and
 * the visitor has to enter the event code (or scan the QR code) again.
 * It also remembers whether the Instagram step of the access flow was
 * already completed for this session, so the gate is never repeated on
 * every gallery navigation.
 *
 * The session holds only what the gallery needs: the event code, the
 * public event fields returned by the lookup, and two timestamps. No
 * credentials, tokens or private data are stored.
 */

const SESSION_KEY = 'markipie:client-session'
const VISITOR_KEY = 'markipie:client-visitor'

/** How long an access session stays valid. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000

function readRaw() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeRaw(session) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Storage unavailable: the gallery still works, codes are just retyped.
  }
}

/**
 * Reads the stored session.
 * @returns {{ code: string, event: object, gateAt: number | null } | null}
 */
export function getClientSession() {
  const parsed = readRaw()
  if (!parsed?.code || !parsed?.event) {
    return null
  }
  // Expired sessions are discarded: the visitor re-authenticates.
  if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
    clearClientSession()
    return null
  }
  return parsed
}

/**
 * Stores the event code with its public info.
 * @param {string} code
 * @param {object} event
 * @param {{ gateCompleted?: boolean }} [options] gateCompleted marks the
 *   Instagram step as already done (used when the gate is disabled for the
 *   event, or when access came through the face scan flow).
 */
export function setClientSession(code, event, options = {}) {
  const now = Date.now()
  writeRaw({
    code,
    event,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    gateAt: options.gateCompleted ? now : null,
  })
}

/**
 * Marks the Instagram step of the current session as completed.
 * @returns {{ code: string, event: object, gateAt: number } | null} the
 *   updated session, or null when nothing valid is stored.
 */
export function completeClientGate() {
  const parsed = readRaw()
  if (!parsed?.code || !parsed?.event) {
    return null
  }
  if (!parsed.expiresAt || parsed.expiresAt <= Date.now()) {
    clearClientSession()
    return null
  }
  if (!parsed.gateAt) {
    parsed.gateAt = Date.now()
    writeRaw(parsed)
  }
  return parsed
}

/** Ends the client session. */
export function clearClientSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.sessionStorage.removeItem(VISITOR_KEY)
  } catch {
    // Nothing to clean.
  }
}

/**
 * Anonymous visitor id for this tab session, used to keep one reaction per
 * media per visitor. It is unrelated to the event code and holds no data.
 */
export function getClientVisitorId() {
  try {
    let id = window.sessionStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return 'anonymous-' + Math.random().toString(36).slice(2, 12)
  }
}
