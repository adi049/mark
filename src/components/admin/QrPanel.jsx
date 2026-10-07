import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, RefreshCw } from 'lucide-react'
import { generateEventToken } from '@/lib/accessCodes'

/**
 * QR foundation for an event. Generates the event access URL
 * (/client-access?event=TOKEN), renders the QR preview and offers a PNG
 * download. The token is stored on the event; regenerating it retires
 * previously printed QR links.
 */
export function QrPanel({ event, onTokenChange }) {
  const token = event?.qr_token
  const [dataUrl, setDataUrl] = useState(null)
  const [renderError, setRenderError] = useState(null)

  // GitHub Pages hosts this project under /mark/. Keep QR links correct even
  // when the admin UI is running from a stale/incorrect BASE_URL build.
  const basePath = window.location.hostname.endsWith('github.io')
    ? '/mark'
    : (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

  const accessUrl = token
    ? `${window.location.origin}${basePath}/client-access?event=${encodeURIComponent(token)}`
    : null

  useEffect(() => {
    if (!accessUrl) {
      setDataUrl(null)
      return undefined
    }
    let alive = true
    QRCode.toDataURL(accessUrl, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#22282b', light: '#ffffff' },
    })
      .then((url) => {
        if (alive) {
          setDataUrl(url)
          setRenderError(null)
        }
      })
      .catch(() => {
        if (alive) {
          setRenderError('The QR code could not be rendered. Please try again.')
        }
      })
    return () => {
      alive = false
    }
  }, [accessUrl])

  if (!token) {
    return (
      <div className="mp-qr">
        <p className="mp-qr__text">
          Generate a secure QR link for this event. The QR points to the client access page
          with this event's private token.
        </p>
        <button
          type="button"
          className="mp-adm-btn mp-adm-btn--primary"
          onClick={() => onTokenChange(generateEventToken())}
        >
          Generate QR code
        </button>
      </div>
    )
  }

  return (
    <div className="mp-qr">
      {dataUrl ? (
        <figure className="mp-qr__figure">
          <img src={dataUrl} alt={`QR code linking to the gallery for ${event?.name ?? 'the event'}`} width={192} height={192} />
        </figure>
      ) : (
        <div className="mp-qr__figure mp-qr__figure--pending" aria-live="polite">
          <span className="mp-adm-spinner" aria-hidden="true" />
          {renderError ? <p className="mp-qr__error">{renderError}</p> : <p>Rendering QR code</p>}
        </div>
      )}

      <p className="mp-qr__url" aria-label="Event access URL">
        {accessUrl}
      </p>

      <div className="mp-qr__actions">
        {dataUrl ? (
          <a
            className="mp-adm-btn mp-adm-btn--primary"
            href={dataUrl}
            download={`markipie-${(event?.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`}
          >
            <Download size={15} aria-hidden="true" />
            Download PNG
          </a>
        ) : null}
        <button
          type="button"
          className="mp-adm-btn mp-adm-btn--secondary"
          onClick={() => onTokenChange(generateEventToken())}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Regenerate
        </button>
      </div>
      <p className="mp-qr__note">Regenerating retires the previous QR link. Reprint cards after regenerating.</p>
    </div>
  )
}
