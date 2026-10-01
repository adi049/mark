import { AlertTriangle, Check, Inbox, RefreshCw, Server } from 'lucide-react'

/**
 * Shared state panels for the admin area: loading, error with retry,
 * empty and the Supabase not-configured notice. Every data view uses
 * these, so no screen is ever blank.
 */

export function AdminLoading({ label = 'Loading' }) {
  return (
    <div className="mp-adm-state" role="status" aria-live="polite">
      <span className="mp-adm-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function AdminError({ message, onRetry }) {
  return (
    <div className="mp-adm-state mp-adm-state--error" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <p>{message || 'The request could not be completed.'}</p>
      {onRetry ? (
        <button type="button" className="mp-adm-state__retry" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function AdminEmpty({ title, note, action }) {
  return (
    <div className="mp-adm-state mp-adm-state--empty">
      <Inbox size={20} aria-hidden="true" />
      <p className="mp-adm-state__title">{title || 'Nothing here yet'}</p>
      {note ? <p className="mp-adm-state__note">{note}</p> : null}
      {action || null}
    </div>
  )
}

const SETUP_STEPS = [
  'Create a project at supabase.com and open the SQL editor.',
  'Run supabase/migrations/0001_markipie_schema.sql from this repository.',
  'Create your admin user under Authentication, Users, Add user.',
  'Copy .env.example to .env.local and fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  'Restart the dev server and sign in here.',
]

export function AdminNotConfigured({ compact = false }) {
  return (
    <div className="mp-adm-state mp-adm-state--setup">
      <Server size={20} aria-hidden="true" />
      <p className="mp-adm-state__title">Supabase is not connected yet</p>
      {compact ? (
        <p className="mp-adm-state__note">
          Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.
          Full steps: supabase/README.md
        </p>
      ) : (
        <ol className="mp-adm-state__steps">
          {SETUP_STEPS.map((step, index) => (
            <li key={step}>
              <span className="mp-adm-state__step-index">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      <p className="mp-adm-state__hint">
        <Check size={13} aria-hidden="true" />
        The website keeps working normally while Supabase is not configured.
      </p>
    </div>
  )
}
