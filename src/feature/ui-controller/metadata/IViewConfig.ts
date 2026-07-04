export interface IViewConfig {
  /** Sub-path appended to the controller path. Empty/omitted = controller index. */
  path?: string
  /** Document <title> for this page. */
  title?: string
  /** Extra <meta> tags rendered into the document head: name -> content. */
  meta?: Record<string, string>
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
