import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, RefreshCw } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import {
  IMPORT_PHASES,
  beginDriveConnect,
  disconnectDrive,
  getDriveJob,
  getDriveStatus,
  isDriveConfigured,
  startDriveImport,
  startDriveSync,
  verifyDriveFolder,
} from '@/lib/drive'

const POLL_MS = 500

/**
 * Google Drive panel for one event: connection state, folder link
 * verification, import with live phases, and sync. All Drive traffic runs
 * through the server boundary in src/lib/drive.js.
 */
export function DrivePanel({ event, onChanged }) {
  const { session } = useAdminAuth()
  const token = session?.access_token ?? null

  const [connection, setConnection] = useState({ loading: true, connected: false, email: null })
  const [folderInput, setFolderInput] = useState('')
  const [verification, setVerification] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [job, setJob] = useState(null)
  const [changing, setChanging] = useState(false)
  const pollRef = useRef(null)

  const refreshConnection = useCallback(async () => {
    if (!token || !isDriveConfigured()) {
      setConnection({ loading: false, connected: false, email: null })
      return
    }
    try {
      const status = await getDriveStatus(token)
      setConnection({ loading: false, connected: Boolean(status.connected), email: status.email })
    } catch {
      setConnection({ loading: false, connected: false, email: null })
    }
  }, [token])

  // Connection status, plus the return flags from the OAuth redirect.
  useEffect(() => {
    refreshConnection()

    const params = new URLSearchParams(window.location.search)
    const flag = params.get('drive')
    if (flag) {
      if (flag === 'connected') {
        setNotice('Google Drive is connected.')
      } else if (flag === 'denied') {
        setError('Google Drive permission was declined. Try again and allow Drive access.')
      } else if (flag === 'not-configured') {
        setError('Google Drive is not configured on the server yet. See supabase/README.md.')
      }
      params.delete('drive')
      const next = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${next ? '?' + next : ''}`)
    }
  }, [refreshConnection])

  // Poll the running job until it finishes.
  useEffect(() => {
    if (!job || job.done || !token) {
      return undefined
    }
    pollRef.current = window.setInterval(async () => {
      try {
        const fresh = await getDriveJob(token, job.id)
        setJob(fresh)
        if (fresh.done) {
          if (fresh.error) {
            setError(fresh.error)
          } else {
            setError(null)
            setChanging(false)
            onChanged?.()
          }
        }
      } catch {
        // One failed poll is not fatal; the next tick retries.
      }
    }, POLL_MS)
    return () => window.clearInterval(pollRef.current)
  }, [job, token, onChanged])

  // Ask the server for the Google consent URL. The server binds a single
  // use OAuth state to this admin session before Google is involved, then
  // the browser is sent to the returned URL.
  const handleConnect = async () => {
    if (busy || !token) {
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { url } = await beginDriveConnect(
        token,
        window.location.pathname + window.location.search
      )
      window.location.assign(url)
    } catch (connectError) {
      setError(connectError.message || 'The Drive connection could not be started. Please try again.')
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (busy) {
      return
    }
    setError(null)
    setNotice(null)
    setVerification(null)
    setBusy(true)
    try {
      const result = await verifyDriveFolder(token, folderInput)
      setVerification(result)
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (busy) {
      return
    }
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const { jobId } = await startDriveImport(token, event.id, folderInput || event.drive_folder_url)
      setJob({ id: jobId, phase: 'connecting', done: false })
    } catch (importError) {
      setError(importError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async () => {
    if (busy) {
      return
    }
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const { jobId } = await startDriveSync(token, event.id)
      setJob({ id: jobId, phase: 'connecting', done: false, kind: 'sync' })
    } catch (syncError) {
      setError(syncError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      await disconnectDrive(token)
      setConnection({ loading: false, connected: false, email: null })
      setVerification(null)
    } catch (disconnectError) {
      setError(disconnectError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isDriveConfigured()) {
    return (
      <div className="mp-adm-drive">
        <div className="mp-adm-hint">
          <p className="mp-adm-hint__title">Google Drive is not configured</p>
          <p className="mp-adm-hint__text">
            Drive import runs through a Supabase edge function. Set up the project and the
            drive function following supabase/README.md, then this panel connects the studio
            Google account.
          </p>
        </div>
      </div>
    )
  }

  const imported = Boolean(event.drive_folder_name)
  const jobPhases = job ? IMPORT_PHASES : []
  const activeIndex = job ? jobPhases.findIndex((p) => p.key === job.phase) : -1

  return (
    <div className="mp-adm-drive">
      <div className="mp-adm-drive__row">
        <div className="mp-adm-drive__connection">
          <p className="mp-adm-drive__label">Google Drive</p>
          {connection.loading ? (
            <p className="mp-adm-drive__value mp-adm-drive__value--muted">Checking connection</p>
          ) : connection.connected ? (
            <p className="mp-adm-drive__value mp-adm-drive__value--ok">
              <Check size={14} aria-hidden="true" />
              Connected{connection.email ? ` as ${connection.email}` : ''}
            </p>
          ) : (
            <p className="mp-adm-drive__value mp-adm-drive__value--muted">Not connected</p>
          )}
        </div>
        {connection.connected ? (
          <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={handleDisconnect} disabled={busy}>
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="mp-adm-btn mp-adm-btn--primary"
            onClick={handleConnect}
            disabled={busy || !token}
          >
            {busy ? 'Connecting' : 'Connect Google Drive'}
          </button>
        )}
      </div>
      <p className="mp-adm-drive__note">
        Only the permission to view Drive files and folders is requested. The studio Google
        account that owns the event folders should connect.
      </p>

      {!connection.connected ? null : (
        <>
          <div className="mp-adm-drive__row mp-adm-drive__row--form">
            <label className="mp-field mp-adm-drive__field">
              <span className="mp-field__label">Google Drive Folder</span>
              <input
                className="mp-field__input"
                type="text"
                value={folderInput}
                onChange={(changeEvent) => setFolderInput(changeEvent.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </label>
            <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={handleVerify} disabled={busy}>
              {busy ? 'Checking' : 'Fetch folder'}
            </button>
          </div>

          {verification ? (
            <div className="mp-adm-drive__verify" role="status">
              <p className="mp-adm-drive__verify-name">
                <Check size={14} aria-hidden="true" />
                Folder found: {verification.name}
              </p>
              <p className="mp-adm-drive__verify-meta">
                {verification.childFolders} child folder{verification.childFolders === 1 ? '' : 's'} ·{' '}
                {verification.mediaFiles} media file{verification.mediaFiles === 1 ? '' : 's'} directly inside
              </p>
            </div>
          ) : null}

          {imported && !job ? (
            <div className="mp-adm-drive__imported">
              <p className="mp-adm-drive__verify-name">
                <Check size={14} aria-hidden="true" />
                Imported folder: {event.drive_folder_name}
              </p>
              <div className="mp-adm-drive__actions">
                <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={handleSync} disabled={busy}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Sync Drive
                </button>
                <button
                  type="button"
                  className="mp-adm-btn mp-adm-btn--secondary"
                  onClick={() => {
                    setChanging(true)
                    setFolderInput('')
                    setVerification(null)
                    setNotice(null)
                    setJob(null)
                  }}
                >
                  Change folder
                </button>
              </div>
            </div>
          ) : null}

          {!imported || changing ? (
            <div className="mp-adm-drive__actions">
              <button
                type="button"
                className="mp-adm-btn mp-adm-btn--primary"
                onClick={handleImport}
                disabled={busy || (!verification && !folderInput.trim())}
              >
                Import Drive folder
              </button>
            </div>
          ) : null}

          {job ? (
            <div className="mp-adm-drive__progress" role="status" aria-live="polite">
              <ol className="mp-adm-drive__phases">
                {jobPhases.map((phase, index) => (
                  <li
                    key={phase.key}
                    className={
                      job.done && !job.error && index <= activeIndex
                        ? 'is-done'
                        : index < activeIndex || (job.done && !job.error)
                          ? 'is-done'
                          : index === activeIndex
                            ? 'is-current'
                            : 'is-pending'
                    }
                  >
                    <span className="mp-adm-drive__phase-icon" aria-hidden="true">
                      {index < activeIndex || (job.done && !job.error) ? (
                        <Check size={12} />
                      ) : index === activeIndex && !job.done ? (
                        <span className="mp-adm-spinner mp-adm-spinner--xs" />
                      ) : (
                        <span className="mp-adm-drive__phase-dot" />
                      )}
                    </span>
                    {phase.label}
                    {job.done && !job.error && index === jobPhases.length - 1 && job.result ? (
                      <span className="mp-adm-drive__phase-result">
                        {job.result.folders} folders · {job.result.photos} photos · {job.result.videos} videos
                        {job.result.duplicates ? ` · ${job.result.duplicates} already imported` : ''}
                        {job.result.added ? ` · ${job.result.added} new` : ''}
                        {job.result.unavailable ? ` · ${job.result.unavailable} removed from Drive` : ''}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              {job.done && job.result ? (
                <div className="mp-adm-drive__actions">
                  <button type="button" className="mp-adm-btn mp-adm-btn--secondary" onClick={() => setJob(null)}>
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mp-adm-form__error" role="alert">
          <AlertTriangle size={13} aria-hidden="true" /> {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mp-adm-drive__notice" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
