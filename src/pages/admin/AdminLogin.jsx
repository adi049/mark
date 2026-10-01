import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { AdminNotConfigured } from '@/components/admin/StatePanels'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { SITE } from '@/lib/constants'

/**
 * Admin login. Real Supabase authentication only: no default, demo or
 * hardcoded credentials, nothing stored beyond the Supabase session.
 * When Supabase is not configured the screen explains the exact setup
 * steps instead of pretending to work.
 */
export function AdminLogin() {
  const { configured, login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)

    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }

    setSubmitting(true)
    const { error: loginError } = await login(email.trim(), password)
    setSubmitting(false)
    if (loginError) {
      setError(loginError.message === 'not-configured' ? 'Supabase is not configured yet.' : loginError.message)
    }
    // On success the auth context updates and AdminEntry redirects.
  }

  return (
    <div className="mp-adm-login">
      <div className="mp-adm-login__card">
        <div className="mp-adm-login__brand">
          <img src={SITE.logoUrl} alt="Markipie" width="132" height="47" />
          <p className="mp-adm-login__title">
            <LockKeyhole size={14} aria-hidden="true" />
            MARKIPIE ADMIN
          </p>
        </div>

        {!configured ? (
          <AdminNotConfigured />
        ) : (
          <form className="mp-adm-login__form" onSubmit={handleSubmit} noValidate>
            <label className="mp-field">
              <span className="mp-field__label">Email</span>
              <input
                className="mp-field__input"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@markipie.com"
                required
              />
            </label>
            <label className="mp-field">
              <span className="mp-field__label">Password</span>
              <input
                className="mp-field__input"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
              />
            </label>

            {error ? (
              <p className="mp-adm-login__error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="mp-adm-btn mp-adm-btn--primary mp-adm-btn--block" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="mp-adm-spinner mp-adm-spinner--light" aria-hidden="true" />
                  Signing in
                </>
              ) : (
                'Login'
              )}
            </button>

            <p className="mp-adm-login__hint">Studio access only. Accounts are created in Supabase by the studio.</p>
          </form>
        )}
      </div>
    </div>
  )
}
