import { singleton } from '@/core/injection'
import { Idempotency } from '@/core/idempotency'

const PRUNE_THRESHOLD = 1000

/** In-memory idempotency store (single process). Keys are held until their TTL. */
@singleton()
export class InMemoryIdempotency extends Idempotency {
  private seen = new Map<string, number>() // key -> expiresAt (ms)

  async alreadyProcessed(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now()
    this.pruneIfLarge(now)

    const expiresAt = this.seen.get(key)
    if (expiresAt !== undefined && expiresAt > now) return true

    this.seen.set(key, now + ttlSeconds * 1000)
    return false
  }

  async forget(key: string): Promise<void> {
    this.seen.delete(key)
  }

  private pruneIfLarge(now: number): void {
    if (this.seen.size < PRUNE_THRESHOLD) return
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key)
    }
  }
}
