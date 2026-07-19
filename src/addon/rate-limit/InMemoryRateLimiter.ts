import { singleton } from '@/core/injection'
import { IRateLimitOptions, IRateLimitResult, RateLimiter } from '@/core/rate-limit'

const PRUNE_THRESHOLD = 1000

/** In-memory fixed-window rate limiter (single process). */
@singleton()
export class InMemoryRateLimiter extends RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>()

  async hit(key: string, { limit, windowSeconds }: IRateLimitOptions): Promise<IRateLimitResult> {
    const now = Date.now()
    this.pruneIfLarge(now)

    let window = this.windows.get(key)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowSeconds * 1000 }
      this.windows.set(key, window)
    }
    window.count++

    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetAt: new Date(window.resetAt),
    }
  }

  private pruneIfLarge(now: number): void {
    if (this.windows.size < PRUNE_THRESHOLD) return
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key)
    }
  }
}
