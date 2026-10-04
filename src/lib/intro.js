/**
 * Opening intro session behavior.
 *
 * The intro runs on every site load by default. The mode can be changed
 * from the admin settings panel (stored in localStorage) or by setting
 * INTRO_SETTINGS.mode:
 *
 *   EVERY_VISIT  runs on every site load (default)
 *   FIRST_VISIT  runs once per browser session, then not again
 *   SKIP         never runs
 */

export const INTRO_MODE = {
  EVERY_VISIT: 'every-visit',
  FIRST_VISIT: 'first-visit',
  SKIP: 'skip',
}

export const INTRO_SETTINGS = {
  mode: INTRO_MODE.EVERY_VISIT,
  storageKey: 'markipie:intro-seen',
  adminPath: '/admin',
}

export const INTRO_MODE_STORAGE_KEY = 'markipie.settings.intro-mode'

function storedMode() {
  try {
    const value = window.localStorage.getItem(INTRO_MODE_STORAGE_KEY)
    return Object.values(INTRO_MODE).includes(value) ? value : null
  } catch {
    return null
  }
}

export function shouldRunIntro() {
  const { storageKey, adminPath } = INTRO_SETTINGS
  const mode = storedMode() ?? INTRO_SETTINGS.mode

  if (mode === INTRO_MODE.SKIP) return false

  const pathname = window.location.pathname.replace(/^\/mark(?=\/|$)/, '') || '/'
  if (pathname === adminPath || pathname.startsWith(`${adminPath}/`)) return false

  if (mode === INTRO_MODE.FIRST_VISIT) {
    try {
      return window.sessionStorage.getItem(storageKey) === null
    } catch {
      return true
    }
  }

  return true
}

export function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SETTINGS.storageKey, '1')
  } catch {}
}
