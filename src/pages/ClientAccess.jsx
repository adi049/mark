import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, CheckCircle2, Info, KeyRound, QrCode, ScanFace, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { ClientGallery } from '@/components/gallery/ClientGallery'
import { InstagramGate } from '@/components/gallery/InstagramGate'
import { FaceScanFlow } from '@/components/facescan/FaceScanFlow'
import { QrScannerDialog } from '@/components/facescan/QrScannerDialog'
import { useSEO } from '@/hooks/useSEO'
import {
  clearClientSession,
  completeClientGate,
  getClientSession,
  setClientSession,
} from '@/lib/clientSession'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

/**
 * Client access. A valid event code (or QR link) opens the client's real
 * gallery: folders, photos and videos served inside the Markipie site.
 * The session lives in sessionStorage so the client moves around without
 * retyping the code, and nothing is stored permanently.
 */
export default function ClientAccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [gate, setGate] = useState(null)
  const gateRef = useRef(null)
  const [eventCode, setEventCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [qrScanOpen, setQrScanOpen] = useState(false)
  const [visitor, setVisitor] = useState(null)
  const [visitorForm, setVisitorForm] = useState({ name: '', phone: '' })
  const [visitorStatus, setVisitorStatus] = useState('idle')
  const [visitorMessage, setVisitorMessage] = useState(null)
  const [pendingToken, setPendingToken] = useState(null)

  // A QR link is authoritative for the event it contains. If this tab
  // already has another client session, replace it instead of silently
  // reopening the old gallery.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('event')
    const stored = getClientSession()

    if (token && token.trim()) {
      const incoming = token.trim()
      const sameSession = stored?.code?.trim() === incoming
      if (!sameSession) {
        clearClientSession()
        setSession(null)
        setGate(null)
        gateRef.current = null
        setEventCode(incoming)
        setPendingToken(incoming)
        return
      }
    }

    if (stored) {
      if (stored.event?.instagram_gate_enabled === true && !stored.gateAt) {
        gateRef.current = stored
        setGate(stored)
      } else {
        setSession(stored)
      }
      return
    }

    if (token) {
      const incoming = token.trim()
      setEventCode(incoming)
      setPendingToken(incoming)
    }
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [faceDescriptor, setFaceDescriptor] = useState(null)
  useEffect(() => {
    if (location.state?.faceDescriptor) {
      const stored = getClientSession()
      if (stored) {
        setSession(stored)
      }
      setFaceDescriptor(location.state.faceDescriptor)
      navigate('/client-access', { replace: true, state: null })
    }
  }, [location.state, navigate])

  useSEO({
    title: 'Client Access',
    description:
      'Open your private Markipie event gallery with your event code, a QR link or an optional face scan.',
    path: '/client-access',
  })

  const lookup = async (rawCode, accessMethod = 'code', contactOverride = null) => {
    let code = String(rawCode || '').trim()
    // QR scanners may return the entire URL rather than only the token.
    try {
      const parsed = new URL(code)
      const qrToken = parsed.searchParams.get('event')
      if (qrToken) code = qrToken.trim()
    } catch {
      // Plain event codes and opaque QR tokens are valid too.
    }
    if (!code) {
      setStatus('idle')
      setMessage('Enter your event code first.')
      return
    }

    const accessVisitor = contactOverride ?? visitor
    if (!accessVisitor?.name || !accessVisitor?.phone) {
      setMessage('Enter your name and valid 10-digit mobile number first.')
      return
    }

    setStatus('checking')
    setMessage(null)

    if (!isSupabaseConfigured) {
      setStatus('error')
      setMessage('The studio gallery service is not connected yet. Please contact Markipie on WhatsApp.')
      return
    }

    try {
      const { data, error } = await supabase.rpc('lookup_event_by_code', { p_code: code })
      if (error) {
        setStatus('error')
        setMessage(friendlyDbError(error))
        return
      }

      const record = Array.isArray(data) ? data[0] : data
      if (!record) {
        setStatus('invalid')
        return
      }

      const { error: accessLogError } = await supabase.rpc('record_gallery_access', {
        p_code: code,
        p_name: accessVisitor.name,
        p_phone: accessVisitor.phone,
        p_method: accessMethod,
      })
      if (accessLogError) {
        setStatus('error')
        setMessage('We could not save your access details securely. Please try again.')
        return
      }

      // Store the exact token/code used for lookup so QR links and typed
      // access codes continue to authorize the same gallery RPCs.
      const gateRequired = record.instagram_gate_enabled === true
      setClientSession(code, record, { gateCompleted: !gateRequired })
      setStatus('idle')
      setMessage(null)
      if (gateRequired) {
        gateRef.current = { code, event: record }
        setGate({ code, event: record })
      } else {
        setSession({ code, event: record })
      }
    } catch (error) {
      setStatus('error')
      setMessage(friendlyDbError(error) || 'Could not connect to the gallery. Please try again.')
    }
  }

  const handleGateCountdownEnd = () => {
    const stored = completeClientGate()
    if (stored) {
      gateRef.current = stored
    }
  }

  const handleGateContinue = () => {
    const stored = completeClientGate()
    setGate(null)
    setSession(stored ?? gateRef.current)
  }

  const handleExit = () => {
    clearClientSession()
    gateRef.current = null
    setSession(null)
    setGate(null)
    setEventCode('')
    setStatus('idle')
    setMessage(null)
    setVisitor(null)
    setVisitorForm({ name: '', phone: '' })
  }

  const handleVisitorChange = (field, value) => {
    setVisitorForm((current) => ({ ...current, [field]: value }))
    setVisitorMessage(null)
    if (visitorStatus !== 'idle') {
      setVisitorStatus('idle')
    }
  }

  const handleVisitorSubmit = (submitEvent) => {
    submitEvent.preventDefault()
    const name = visitorForm.name.trim().replace(/\s+/g, ' ')
    const phone = visitorForm.phone.replace(/\D/g, '')

    if (name.length < 2 || !/^[\p{L}][\p{L}\p{M} .'-]{1,99}$/u.test(name)) {
      setVisitorStatus('error')
      setVisitorMessage('Please enter a valid name.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setVisitorStatus('error')
      setVisitorMessage('Please enter a valid 10-digit Indian mobile number.')
      return
    }

    const contact = { name, phone }
    setVisitor(contact)
    setVisitorForm({ name, phone })
    setVisitorStatus('idle')
    setVisitorMessage(null)

    if (pendingToken) {
      lookup(pendingToken, 'qr', contact)
      setPendingToken(null)
    }
  }

  const handleCodeChange = (value) => {
    setEventCode(value)
    if (status !== 'idle') {
      setStatus('idle')
      setMessage(null)
    }
  }

  if (session) {
    return (
      <>
        <PageHero
          eyebrow="Client gallery"
          title={session.event?.name ?? 'Your event gallery'}
          description="Your private event gallery, delivered by Markipie."
        />
        <Section className="mp-client-gallery">
          <Container>
            <ClientGallery
              code={session.code}
              event={session.event}
              onExit={handleExit}
              onInvalid={handleExit}
              initialDescriptor={faceDescriptor}
            />
          </Container>
        </Section>
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Client access"
        title="Your private event gallery"
        description="If Markipie has covered your event, your gallery reaches you through this page. Choose the way that suits you."
      />

      <Section className="mp-client-access">
        <Container>
          <div className="mp-callout" role="note">
            <Info size={18} aria-hidden="true" />
            <p>
              Enter the event code from your delivery message. Your photos and videos open right
              here, inside the Markipie site.
            </p>
          </div>

          {!visitor ? (
            <form className="mp-access-card mp-access-card--blue" onSubmit={handleVisitorSubmit}>
              <span className="mp-access-card__icon">
                <User size={24} aria-hidden="true" />
              </span>
              <h2 className="mp-access-card__title">Your Details</h2>
              <p className="mp-access-card__text">
                Enter your name and mobile number before opening your private event gallery.
              </p>
              <div className="mp-access-card__fields">
                <label className="mp-field">
                  <span className="mp-field__label">Full name</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    value={visitorForm.name}
                    onChange={(event) => handleVisitorChange('name', event.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                </label>
                <label className="mp-field">
                  <span className="mp-field__label">Mobile number</span>
                  <input
                    className="mp-field__input"
                    type="tel"
                    inputMode="numeric"
                    value={visitorForm.phone}
                    onChange={(event) => handleVisitorChange('phone', event.target.value)}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    maxLength={10}
                    required
                  />
                </label>
                <Button type="submit">
                  Continue to Gallery Access
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
              {visitorStatus === 'error' ? (
                <p className="mp-access-card__note mp-access-card__note--error" role="alert">
                  {visitorMessage}
                </p>
              ) : null}
              <p className="mp-access-card__note">
                Your details are used for this gallery access record and are not used as an OTP login.
              </p>
            </form>
          ) : null}

          {visitor ? <div className="mp-client-access__grid">
            <form
              id="event-code"
              className="mp-access-card mp-access-card--blue"
              onSubmit={(event) => {
                event.preventDefault()
                lookup(eventCode)
              }}
            >
              <span className="mp-access-card__icon">
                <KeyRound size={24} aria-hidden="true" />
              </span>
              <h2 className="mp-access-card__title">Event Code</h2>
              <p className="mp-access-card__text">
                Enter the personal event code from your delivery message to open your gallery.
              </p>
              <div className="mp-access-card__fields">
                <label className="mp-field">
                  <span className="mp-field__label">Event code</span>
                  <input
                    className="mp-field__input"
                    type="text"
                    name="event-code"
                    value={eventCode}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    placeholder="For example MP-4K7RQP"
                    autoComplete="off"
                  />
                </label>
                <Button type="submit" disabled={status === 'checking'}>
                  {status === 'checking' ? 'Checking' : 'Open Gallery'}
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>

              {status === 'invalid' ? (
                <p className="mp-access-card__note mp-access-card__note--error" role="alert">
                  Invalid or expired access code.
                </p>
              ) : null}
              {status === 'error' ? (
                <p className="mp-access-card__note mp-access-card__note--error" role="alert">
                  {message}
                </p>
              ) : null}
              {status === 'idle' && message ? (
                <p className="mp-access-card__note" role="status">
                  {message}
                </p>
              ) : null}

              {status === 'checking' ? (
                <p className="mp-access-card__note" role="status">
                  <CheckCircle2 size={13} aria-hidden="true" /> Checking your code
                </p>
              ) : null}
            </form>

            <div id="scan-qr" className="mp-access-card mp-access-card--green">
              <span className="mp-access-card__icon">
                <QrCode size={24} aria-hidden="true" />
              </span>
              <h2 className="mp-access-card__title">Scan QR Code</h2>
              <p className="mp-access-card__text">
                Scan the QR code on your delivery card. It opens this page with your gallery
                ready.
              </p>
              <div className="mp-access-card__fields">
                <Button type="button" variant="secondary" onClick={() => setQrScanOpen(true)}>
                  <Camera size={16} aria-hidden="true" />
                  Open QR Scanner
                </Button>
                <p className="mp-access-card__note mp-access-card__note--plain">
                  Scan the studio QR card here, or open it with your phone camera. If camera
                  scanning is not supported, paste the link or enter the event code.
                </p>
              </div>
            </div>

            <div id="face-scan" className="mp-access-card mp-access-card--pink">
              <span className="mp-access-card__icon">
                <ScanFace size={24} aria-hidden="true" />
              </span>
              <h2 className="mp-access-card__title">Scan Your Face</h2>
              <p className="mp-access-card__text">
                Scan your face with your device camera and we will match you straight to your
                photos.
              </p>
              <div className="mp-access-card__fields">
                <Button variant="secondary" onClick={() => setScanOpen(true)}>
                  <Camera size={16} aria-hidden="true" />
                  Start Face Scan
                </Button>
                <p className="mp-access-card__note mp-access-card__note--plain">
                  The scan runs in your browser and searches only your own event.
                </p>
              </div>
            </div>
          </div> : null}
        </Container>
      </Section>

      <FaceScanFlow
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        visitor={visitor}
      />
      <QrScannerDialog
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onDetected={(value) => {
          setQrScanOpen(false)
          setEventCode(value)
          lookup(value, 'qr')
        }}
      />
      {gate ? (
        <InstagramGate
          event={gate.event}
          onCountdownEnd={handleGateCountdownEnd}
          onContinue={handleGateContinue}
        />
      ) : null}
    </>
  )
}
