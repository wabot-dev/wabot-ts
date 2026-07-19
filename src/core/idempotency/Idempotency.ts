/**
 * Deduplication / idempotency primitive. Records a key for a TTL so repeated
 * deliveries of the same event (e.g. a webhook a provider retries) are handled
 * once. Two implementations are selected by the project runner from
 * `DATABASE_URL`: an in-memory one (single process) and a Postgres one (atomic
 * and safe across instances).
 */
export class Idempotency {
  /**
   * Atomically record `key` and report whether it was already recorded within
   * the TTL. Returns `true` when the key was seen before (a duplicate to skip),
   * `false` on first sight (records it for `ttlSeconds`, so a later retry after
   * the window is processed again).
   */
  alreadyProcessed(key: string, ttlSeconds: number): Promise<boolean> {
    throw new Error('Not implemented')
  }

  /** Drop a key so it can be processed again — used to roll back a failed attempt. */
  forget(key: string): Promise<void> {
    throw new Error('Not implemented')
  }

  /**
   * Run `fn` only the first time `key` is seen within the TTL. Returns `true` if
   * it ran, `false` if skipped as a duplicate. If `fn` throws, the key is
   * released so a retry can reprocess it.
   */
  async runOnce(key: string, ttlSeconds: number, fn: () => Promise<void>): Promise<boolean> {
    if (await this.alreadyProcessed(key, ttlSeconds)) return false
    try {
      await fn()
    } catch (err) {
      await this.forget(key).catch(() => {})
      throw err
    }
    return true
  }
}
