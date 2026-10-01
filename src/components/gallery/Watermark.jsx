/**
 * MARKIPIE watermark overlay for gallery photos and videos.
 *
 * Presentation only: a translucent wordmark laid over the displayed media.
 * The underlying Drive files are never modified. Shown when the event has
 * watermark_enabled set.
 */
export function Watermark({ compact = false }) {
  return (
    <div className={`mp-wm${compact ? ' mp-wm--compact' : ''}`} aria-hidden="true">
      <span>MARKIPIE</span>
      <span>MARKIPIE</span>
      <span>MARKIPIE</span>
      <span>MARKIPIE</span>
      <span>MARKIPIE</span>
      <span>MARKIPIE</span>
    </div>
  )
}
