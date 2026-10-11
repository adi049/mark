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
export function FaceScanFlow({ open, onClose }) {
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
      const { data, error } = await supabase.rpc('search_all_event_faces', {
        p_embedding: descriptorToText(descriptor),
        p_threshold: 0.6,
      })
      if (error) throw error

      const rows = Array.isArray(data) ? data : []
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
