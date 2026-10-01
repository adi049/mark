/**
 * Event permission layer (Phase 9).
 *
 * Single source of truth for what a client is allowed to see and do in an
 * event gallery. Every component reads permissions through this helper so
 * the rules live in one place instead of being duplicated across the
 * gallery, viewer, face scan and admin surfaces.
 *
 * Defaults mirror the database column defaults:
 *   watermark, download, reactions and the Instagram gate default to ON,
 *   the face scan defaults to OFF. Values from older sessions that lack a
 *   flag keep those same defaults.
 *
 * Payment status is intentionally NOT part of this layer: it is studio
 * information only and never changes a permission by itself.
 */

/**
 * @param {object | null} event public event record (lookup or stored session)
 * @returns {{
 *   watermark: boolean,
 *   download: boolean,
 *   reactions: boolean,
 *   faceScan: boolean,
 *   instagramGate: boolean,
 * }}
 */
export function eventPermissions(event) {
  return {
    watermark: event?.watermark_enabled !== false,
    download: event?.download_enabled !== false,
    reactions: event?.reaction_enabled !== false,
    faceScan: event?.face_scan_enabled === true,
    instagramGate: event?.instagram_gate_enabled !== false,
  }
}

/** Human labels for the admin summary, in display order. */
export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid']

/** Display label for a payment status value. */
export function paymentLabel(status) {
  if (status === 'paid') {
    return 'PAID'
  }
  if (status === 'partial') {
    return 'PARTIAL'
  }
  return 'UNPAID'
}
