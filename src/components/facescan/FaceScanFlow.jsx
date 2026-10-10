import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound } from 'lucide-react'
import { FaceScanDialog } from '@/components/facescan/FaceScanDialog'
import { Button } from '@/components/ui/Button'
import { setClientSession } from '@/lib/clientSession'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

/**
 * Face scan for visitors who are not inside a gallery yet (Home page and
 * the Client Access entry card). The scan runs first, then the event code
 * is asked for, and the search stays scoped to that one authorized event.
 * On success the visitor lands in their gallery with the matches open.
 */
export function FaceScanFlow({ open, onClose, visitor }) {
  const navigate = useNavigate()
  const [descriptor, setDescriptor] = useState(null)
  const [eventCode, setEventCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | checking | invalid | error
  const [message, setMessage] = useState(null)

  const close = () => {
    setDescriptor(null)
    setEventCode('')
    setStatus('idle')
    setMessage(null)
    onClose?.()
  }

  const submitCode = async (submitEvent) => {
    submitEvent.preventDefault()
    const code = eventCode.trim()
    if (!code) {
      setStatus('idle')
      setMessage('Enter your event code first.')
      return
    }
    if (!isSupabaseConfigured) {
      setStatus('error')
      setMessage('The studio gallery service is not connected yet. Please contact Markipie on WhatsApp.')
      return
    }

    setStatus('checking')
    setMessage(null)
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
      if (!record.face_scan_enabled) {
        setStatus('error')
        setMessage('Face scan is not enabled for this event. Open your gallery with the event code.')
        return
      }

      if (!visitor?.name || !visitor?.phone) {
        setStatus('error')
        setMessage('Enter your name and valid mobile number before starting face access.')
        return
      }

      const { error: accessLogError } = await supabase.rpc('record_gallery_access', {
        p_code: code,
        p_name: visitor.name,
        p_phone: visitor.phone,
        p_method: 'face',
      })
      if (accessLogError) {
        setStatus('error')
        setMessage('We could not save your access details securely. Please try again.')
        return
      }

      // Send a best-effort notification to the client linked to this event.
      void supabase.functions.invoke('notify-gallery-access', {
        body: {
          code,
          name: visitor.name,
          phone: visitor.phone,
          method: 'face',
        },
      }).then(({ error: emailError }) => {
        if (emailError) console.warn('Gallery access email notification failed:', emailError.message)
      }).catch((emailError) => {
        console.warn('Gallery access email notification failed:', emailError)
      })

      const captured = descriptor
      // The face scan path keeps its own validated workflow and does not
      // pass through the Instagram gate, so the session starts with that
      // step already marked complete.
      setClientSession(code, record, { gateCompleted: true })
      setDescriptor(null)
      setEventCode('')
      setStatus('idle')
      setMessage(null)
      onClose?.()
      navigate('/client-access', { state: { faceDescriptor: captured } })
    } catch (error) {
      setStatus('error')
      setMessage(friendlyDbError(error) || 'Could not connect to the gallery. Please try again.')
    }
  }

  return (
    <FaceScanDialog
      open={open}
      onClose={close}
      onCaptured={setDescriptor}
      title={descriptor ? 'Your Event Code' : 'AI Face Scan'}
    >
      {descriptor ? (
        <div className="mp-fs__code">
          <span className="mp-fs__orb mp-fs__orb--small" aria-hidden="true">
            <KeyRound size={20} aria-hidden="true" />
          </span>
          <p className="mp-fs__lead">
            Your face is ready. Enter your event code and we will search your gallery for
            matching photos.
          </p>
          <form className="mp-fs__form" onSubmit={submitCode}>
            <label className="mp-field">
              <span className="mp-field__label">Event code</span>
              <input
                className="mp-field__input"
                type="text"
                value={eventCode}
                onChange={(change) => {
                  setEventCode(change.target.value)
                  if (status !== 'idle') {
                    setStatus('idle')
                    setMessage(null)
                  }
                }}
                placeholder="For example MP-4K7RQP"
                autoComplete="off"
                autoFocus
              />
            </label>
            <Button type="submit" disabled={status === 'checking'}>
              {status === 'checking' ? 'Searching' : 'Find My Photos'}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>
          {status === 'invalid' ? (
            <p className="mp-fs__error" role="alert">
              Invalid or expired access code.
            </p>
          ) : null}
          {status === 'error' ? (
            <p className="mp-fs__error" role="alert">
              {message}
            </p>
          ) : null}
          {status === 'idle' && message ? (
            <p className="mp-fs__note" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </FaceScanDialog>
  )
}
