import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaceScanDialog } from '@/components/facescan/FaceScanDialog'
import { descriptorToText } from '@/lib/faceEngine'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * Code-free, face-only access. The database issues a short-lived media grant
 * containing only photos matched to the captured face. No event code or full
 * gallery session is created.
 */
export function FaceScanFlow({ open, onClose, eventId }) {
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)

  const handleCaptured = async (descriptor) => {
    if (!isSupabaseConfigured || !supabase) {
      navigate('/client-access', {
        state: { faceOnlyError: 'The gallery service is not connected. Please try again shortly.' },
      })
      onClose?.()
      return
    }

    setSearching(true)
    try {
      if (!eventId) throw new Error('Please open the event QR first, then start Face Scan.')
      const { data, error } = await supabase.rpc('search_event_faces', {
        p_event_id: eventId,
        p_embedding: descriptorToText(descriptor),
        p_threshold: 0.52,
      })
      if (error) throw error

      let rows = Array.isArray(data) ? data : []
      // If the strict pass is empty, allow a controlled second pass. This
      // improves recall for camera-vs-photo differences without making the
      // primary result set overly loose.
      if (rows.length === 0) {
        const retry = await supabase.rpc('search_event_faces', {
          p_event_id: eventId,
          p_embedding: descriptorToText(descriptor),
          p_threshold: 0.58,
        })
        if (retry.error) throw retry.error
        rows = Array.isArray(retry.data) ? retry.data : []
      }
      navigate('/client-access', {
        state: {
          faceOnlyMatches: rows,
          faceToken: rows[0]?.face_token ?? null,
        },
      })
    } catch (error) {
      navigate('/client-access', {
        state: {
          faceOnlyError: error?.message || 'Face search could not be completed. Please try again.',
        },
      })
    } finally {
      setSearching(false)
      onClose?.()
    }
  }

  return (
    <FaceScanDialog
      open={open}
      onClose={onClose}
      onCaptured={handleCaptured}
      title={searching ? 'Finding Your Photos' : 'AI Face Scan'}
    />
  )
}
