import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2, X } from 'lucide-react'

/**
 * QR reader for supported browsers. Camera tracks are always stopped on
 * close/unmount. A paste-link fallback is provided where BarcodeDetector
 * is unavailable, so access is never blocked by browser support.
 */
export function QrScannerDialog({ open, onClose, onDetected }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const activeRef = useRef(false)
  const [status, setStatus] = useState('starting')
  const [message, setMessage] = useState('')
  const [manualValue, setManualValue] = useState('')

  useEffect(() => {
    activeRef.current = open
    if (!open) {
      stop()
      return undefined
    }

    let timer = null
    let detector = null
    let busy = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('manual')
        setMessage('Camera access is unavailable in this browser. Paste the QR link below.')
        return
      }
      if (!('BarcodeDetector' in window)) {
        setStatus('manual')
        setMessage('This browser does not support built-in QR scanning. Paste the QR link below, or open the QR with your phone camera.')
        return
      }
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!activeRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')
        setMessage('Hold the QR code steady inside the camera frame.')
        timer = window.setInterval(async () => {
          const video = videoRef.current
          if (busy || !activeRef.current || !video || video.readyState < 2) return
          busy = true
          try {
            const results = await detector.detect(video)
            const value = results?.[0]?.rawValue
            if (value && activeRef.current) {
              activeRef.current = false
              stop()
              onDetected?.(value)
            }
          } catch {
            // A frame can be undecodable while the camera is moving.
          } finally {
            busy = false
          }
        }, 250)
      } catch (error) {
        setStatus('manual')
        setMessage(error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or paste the QR link below.'
          : 'Could not start the camera. Paste the QR link below instead.')
      }
    }

    start()
    return () => {
      activeRef.current = false
      if (timer) window.clearInterval(timer)
      stop()
    }
    // This effect owns one camera session per open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const stop = () => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => {
        try { track.stop() } catch { /* already stopped */ }
      })
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  if (!open) return null

  const submitManual = (event) => {
    event.preventDefault()
    const value = manualValue.trim()
    if (!value) {
      setMessage('Paste the event QR link or event code first.')
      return
    }
    stop()
    onDetected?.(value)
  }

  return (
    <div className="mp-fs" role="dialog" aria-modal="true" aria-label="Scan event QR code">
      <div className="mp-fs__card">
        <div className="mp-fs__head">
          <div>
            <p className="mp-fs__eyebrow">Markipie Client Access</p>
            <h2 className="mp-fs__title">Scan QR Code</h2>
          </div>
          <button type="button" className="mp-fs__close" onClick={() => { stop(); onClose?.() }} aria-label="Close QR scanner">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {status === 'starting' || status === 'scanning' ? (
          <div className="mp-fs__camera">
            <video ref={videoRef} autoPlay muted playsInline aria-label="QR scanning camera" />
            {status === 'starting' ? <p><Loader2 size={16} /> Starting camera…</p> : null}
          </div>
        ) : (
          <div className="mp-fs__start">
            <span className="mp-fs__orb" aria-hidden="true">
              {status === 'manual' ? <CameraOff size={26} /> : <Camera size={26} />}
            </span>
          </div>
        )}
        <p className="mp-fs__note" role="status">{message}</p>
        {status === 'manual' ? (
          <form className="mp-fs__form" onSubmit={submitManual}>
            <label className="mp-field">
              <span className="mp-field__label">QR link or event code</span>
              <input className="mp-field__input" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Paste link or enter code" autoComplete="off" />
            </label>
            <button className="mp-adm-btn mp-adm-btn--primary" type="submit">Open Gallery</button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
