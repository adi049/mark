/**
 * Suspense fallback shown while a lazy loaded route chunk arrives.
 */
export function RouteLoading() {
  return (
    <div className="mp-route-loading" role="status">
      <span className="mp-visually-hidden">Loading page</span>
      <div className="mp-route-loading__dots" aria-hidden="true">
        <span className="mp-route-loading__dot" />
        <span className="mp-route-loading__dot" />
        <span className="mp-route-loading__dot" />
      </div>
    </div>
  )
}
