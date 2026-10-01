import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { eventPermissions, PAYMENT_STATUSES, paymentLabel } from '@/lib/eventPermissions'
import { formatDate } from '@/lib/format'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { supabase } from '@/lib/supabase'
import { friendlyDbError } from '@/lib/dbErrors'

const PERMISSION_ROWS = [
  {
    key: 'watermark_enabled',
    label: 'Watermark',
    note: 'Stays on until you turn it off. Marking payment as paid never removes it automatically.',
  },
  {
    key: 'download_enabled',
    label: 'Download photos and videos',
    note: 'When off, clients see no download option in the gallery.',
  },
  {
    key: 'reaction_enabled',
    label: 'Like / dislike',
    note: 'Clients see like and dislike controls. Only the studio sees the aggregated selections.',
  },
  {
    key: 'face_scan_enabled',
    label: 'Face scan',
    note: 'Lets clients find their own photos with a live camera scan.',
  },
  {
    key: 'instagram_gate_enabled',
    label: 'Instagram gate',
    note: 'Shows the Instagram step before the gallery opens.',
  },
]

/**
 * Payment status and permission controls for one event, with a summary that
 * reflects the actual database values. Payment status is a studio label
 * only: no payment provider is connected and nothing here claims a payment
 * was verified. Changing it never changes a permission by itself.
 */
export function EventPermissionsPanel({ event, onChanged }) {
  const { user } = useAdminAuth()
  const [payment, setPayment] = useState(event?.payment_status ?? 'unpaid')
  const [paymentMeta, setPaymentMeta] = useState({
    at: event?.payment_updated_at ?? null,
    by: event?.payment_updated_by ?? null,
  })
  const [flags, setFlags] = useState(() => ({
    watermark_enabled: event?.watermark_enabled ?? true,
    download_enabled: event?.download_enabled ?? true,
    reaction_enabled: event?.reaction_enabled ?? true,
    face_scan_enabled: event?.face_scan_enabled ?? false,
    instagram_gate_enabled: event?.instagram_gate_enabled ?? true,
  }))
  const [permissionsMeta, setPermissionsMeta] = useState({
    at: event?.permissions_updated_at ?? null,
    by: event?.permissions_updated_by ?? null,
  })
  const [busy, setBusy] = useState(null) // 'payment' | flag key
  const [error, setError] = useState(null)

  // Keep the panel in sync when the parent refetches the event.
  useEffect(() => {
    setPayment(event?.payment_status ?? 'unpaid')
    setPaymentMeta({ at: event?.payment_updated_at ?? null, by: event?.payment_updated_by ?? null })
    setPermissionsMeta({
      at: event?.permissions_updated_at ?? null,
      by: event?.permissions_updated_by ?? null,
    })
    setFlags({
      watermark_enabled: event?.watermark_enabled ?? true,
      download_enabled: event?.download_enabled ?? true,
      reaction_enabled: event?.reaction_enabled ?? true,
      face_scan_enabled: event?.face_scan_enabled ?? false,
      instagram_gate_enabled: event?.instagram_gate_enabled ?? true,
    })
  }, [event])

  const changePayment = async (status) => {
    if (busy || status === payment) {
      return
    }
    setBusy('payment')
    setError(null)
    const previous = { payment, meta: paymentMeta }
    setPayment(status)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_set_payment_status', {
        p_event_id: event.id,
        p_status: status,
      })
      if (rpcError) {
        throw rpcError
      }
      const record = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
      setPaymentMeta({ at: record.payment_updated_at ?? null, by: record.payment_updated_by ?? null })
      onChanged?.()
    } catch (updateError) {
      setPayment(previous.payment)
      setPaymentMeta(previous.meta)
      setError(friendlyDbError(updateError))
    } finally {
      setBusy(null)
    }
  }

  const changeFlag = async (key, value) => {
    if (busy) {
      return
    }
    setBusy(key)
    setError(null)
    const previous = flags[key]
    setFlags((current) => ({ ...current, [key]: value }))
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({
          [key]: value,
          permissions_updated_at: new Date().toISOString(),
          permissions_updated_by: user?.email ?? 'admin',
        })
        .eq('id', event.id)
      if (updateError) {
        throw updateError
      }
      setPermissionsMeta({ at: new Date().toISOString(), by: user?.email ?? 'admin' })
      onChanged?.()
    } catch (updateError) {
      setFlags((current) => ({ ...current, [key]: previous }))
      setError(friendlyDbError(updateError))
    } finally {
      setBusy(null)
    }
  }

  const summary = eventPermissions({ ...flags })

  return (
    <div className="mp-adm-perm">
      <div className="mp-adm-face__heading">
        <p className="mp-adm-drive__label">Payment and permissions</p>
        {error ? (
          <p className="mp-adm-perm__error" role="alert">
            <AlertTriangle size={13} aria-hidden="true" /> {error}
          </p>
        ) : null}
      </div>

      {/* Summary reflecting the actual stored values */}
      <div className="mp-adm-perm__summary">
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Payment</span>
          <span className={`mp-adm-perm__pay mp-adm-perm__pay--${payment}`}>{paymentLabel(payment)}</span>
        </div>
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Watermark</span>
          <span className="mp-adm-perm__cell-value">{summary.watermark ? 'ON' : 'OFF'}</span>
        </div>
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Download</span>
          <span className="mp-adm-perm__cell-value">{summary.download ? 'ON' : 'OFF'}</span>
        </div>
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Face scan</span>
          <span className="mp-adm-perm__cell-value">{summary.faceScan ? 'ON' : 'OFF'}</span>
        </div>
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Like / dislike</span>
          <span className="mp-adm-perm__cell-value">{summary.reactions ? 'ON' : 'OFF'}</span>
        </div>
        <div className="mp-adm-perm__cell">
          <span className="mp-adm-perm__cell-label">Instagram gate</span>
          <span className="mp-adm-perm__cell-value">{summary.instagramGate ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      {/* Payment status control */}
      <div className="mp-adm-perm__block">
        <p className="mp-adm-perm__block-title">
          <CreditCard size={14} aria-hidden="true" /> Payment status
        </p>
        <p className="mp-adm-perm__block-note">
          A studio label only. No online payment is collected or verified here.
        </p>
        <div className="mp-adm-perm__pay-buttons" role="group" aria-label="Payment status">
          {PAYMENT_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`mp-adm-perm__pay-btn${payment === status ? ' is-active' : ''}`}
              aria-pressed={payment === status}
              disabled={busy === 'payment'}
              onClick={() => changePayment(status)}
            >
              {busy === 'payment' && payment === status ? (
                <Loader2 size={13} className="mp-adm-spinner mp-adm-spinner--xs" aria-hidden="true" />
              ) : payment === status ? (
                <CheckCircle2 size={13} aria-hidden="true" />
              ) : null}
              {paymentLabel(status)}
            </button>
          ))}
        </div>
        <dl className="mp-adm-perm__meta">
          <div>
            <dt>Last updated</dt>
            <dd>{paymentMeta.at ? formatDate(paymentMeta.at) : 'Not yet'}</dd>
          </div>
          <div>
            <dt>Updated by</dt>
            <dd>{paymentMeta.by ?? 'Not yet'}</dd>
          </div>
        </dl>
      </div>

      {/* Permission switches */}
      <div className="mp-adm-perm__block">
        <p className="mp-adm-perm__block-title">Event permissions</p>
        {PERMISSION_ROWS.map((row) => (
          <div key={row.key} className="mp-adm-perm__row">
            <div className="mp-adm-perm__row-text">
              <span className="mp-adm-perm__row-label">{row.label}</span>
              <span className="mp-adm-perm__row-note">{row.note}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(flags[row.key])}
              aria-label={row.label}
              className={`mp-adm-perm__switch${flags[row.key] ? ' is-on' : ''}`}
              disabled={busy === row.key}
              onClick={() => changeFlag(row.key, !flags[row.key])}
            >
              <span className="mp-adm-perm__switch-track">
                <span className="mp-adm-perm__switch-thumb" />
              </span>
              <span className="mp-adm-perm__switch-text">{flags[row.key] ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        ))}
        <dl className="mp-adm-perm__meta">
          <div>
            <dt>Permissions updated</dt>
            <dd>{permissionsMeta.at ? formatDate(permissionsMeta.at) : 'Not yet'}</dd>
          </div>
          <div>
            <dt>Updated by</dt>
            <dd>{permissionsMeta.by ?? 'Not yet'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
