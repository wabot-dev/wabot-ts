export interface IViewConfig {
  /** Sub-path appended to the controller path. Empty/omitted = controller index. */
  path?: string
  /** Document <title> for this page. */
  title?: string
  /** Extra <meta> tags rendered into the document head: name -> content. */
  meta?: Record<string, string>
  /**
   * Serve this route as a statically generated page: render it once and cache
   * the full HTML, then serve the cached bytes for every request without running
   * the handler or SSR again. Public/stateless routes only — the cached document
   * is shared across all visitors, so per-request middleware is skipped (declaring
   * a guard on a static view is a misconfiguration and is warned about).
   *
   * - `true` — generated once (pre-rendered at startup for non-parameterized
   *   routes) and kept until the server restarts.
   * - `{ revalidate: N }` — ISR: serve the cached page; once it is older than N
   *   seconds the next request gets it while a fresh copy regenerates in the
   *   background (stale-while-revalidate).
   *
   * Parameterized routes (`/x/:id`) are generated lazily on first request and
   * cached per URL. Invalidate any route on demand via the injectable
   * `StaticPageCache`.
   */
  static?: boolean | { revalidate?: number }
  /**
   * Stale-while-revalidate hints for boosted navigation (`app: true`
   * controllers). Only meaningful for the soft-nav client cache.
   */
  swr?: {
    /**
     * Seconds a cached fragment is considered fresh: within this window a
     * revisit renders from cache without a background revalidation. Default 0
     * (always revalidate in the background).
     */
    maxAge?: number
    /**
     * Cheap revalidation tag (the SWR key). When provided, boosted-nav
     * revalidation compares this against `If-None-Match` and can answer 304
     * *without* running the view handler or SSR. Receives the request with
     * body+query+params merged, so parameterized routes can (and should) key off
     * their route params — e.g. `version: ({ id }) => docRevision(id)`.
     * Return a short, deterministic string (a data timestamp or revision).
     */
    version?: (request: any) => string | Promise<string>
  }
}
