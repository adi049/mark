/**
 * Small formatting helpers shared by the admin panel and public pages.
 */

/** Statuses stored as lowercase values get readable labels. */
export function statusLabel(status) {
  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived',
  }
  return labels[status] ?? status ?? 'Active'
}

/** ISO date (YYYY-MM-DD) or timestamp to a readable Indian date. */
export function formatDate(value) {
  if (!value) {
    return 'Not set'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Not set'
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
