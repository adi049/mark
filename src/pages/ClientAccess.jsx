import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Camera, CheckCircle2, Info, KeyRound, QrCode, ScanFace } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/ui/PageHero'
import { Section } from '@/components/ui/Section'
import { ClientGallery } from '@/components/gallery/ClientGallery'
import { InstagramGate } from '@/components/gallery/InstagramGate'
import { FaceScanFlow } from '@/components/facescan/FaceScanFlow'
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
  const [gate, setGate] = useState(null) // { code, event } awaiting the Instagram step
  const gateRef = useRef(null)
  const [eventCode, setEventCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | invalid | error
  const [message, setMessage] = useState(null)
  const [scanOpen, setScanOpen] = useState(false)

  // A stored access session is restored on mount. When its Instagram step
  // was not completed yet, the gate shows again instead of the gallery, so
  // the step cannot be skipped by reloading mid-countdown.
  useEffect(() => {
    const stored = getClientSession()
    if (stored) {
      if (stored.event?.instagram_gate_enabled !== false && !stored.gateAt) {
        gateRef.current = stored
        setGate(stored)
      } else {
        setSession(stored)
      }
      return
    }
    // QR links arrive as /client-access?event=TOKEN and resolve automatically.
    const token = new URLSearchParams(window.location.search).get('event')
    if (token) {
      setEventCode(token)
      lookup(token)
    }
    // Runs once on mount: the stored session or QR token is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A face scan finished (on the Home page or here) and produced an event
  // session plus a captured descriptor: open the gallery straight into the
  // matched photos, then drop the descriptor from the address state.
  const [faceDescriptor, setFaceDescriptor] = useState(null)
  useEffect(() => {
    if (location.state?.faceDescriptor) {
      // When the scan started on this page the session was persisted by
      // the flow itself; this page is already mounted, so its session state
      // has to be re-read instead of waiting for a remount.
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

  const lookup = async (rawCode) => {
    const code = String(rawCode || '').trim()
    if (!code) {
      setStatus('idle')
      setMessage('Enter your event code first.')
      return
    }

    setStatus('checking')
    setMessage(null)

    if (!isSupabaseConfigured) {
      setStatus('error')
      setMessage('The studio gallery service is not connected yet. Please contact Markipie on WhatsApp.')
      return
    }

    const { data, error } = await supabase.rpc('lookup_event_by_code', { p_code: code })
    if (error) {
      setStatus('error')
      setMessage(friendlyDbError(error))
      return
    }

    // The RPC returns a row or a one-element array depending on the client.
    const record = Array.isArray(data) ? data[0] : data
    if (!record) {
      setStatus('invalid')
      return
    }

    // Valid: open the client session. When the Instagram gate is enabled
    // for this event, the gallery only opens after that step; the session
    // is stored first so returning from Instagram never loses the gallery.
    const gateRequired = record.instagram_gate_enabled !== false
    setClientSession(code, record, { gateCompleted: !gateRequired })
    setStatus('idle')
    setMessage(null)
    if (gateRequired) {
      gateRef.current = { code, event: record }
      setGate({ code, event: record })
    } else {
      setSession({ code, event: record })
    }
  }

  // The gate countdown finished: persist the completed step right away so
  // a visitor who leaves for Instagram and returns never repeats it.
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

          <div className="mp-client-access__grid">
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
                <p className="mp-access-card__note mp-access-card__note--plain">
                  QR cards carry a private link for your event. Scanning one opens your gallery
                  automatically.
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
          </div>
        </Container>
      </Section>

      <FaceScanFlow open={scanOpen} onClose={() => setScanOpen(false)} />

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
