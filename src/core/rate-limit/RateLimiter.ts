export interface IRateLimitOptions {
  /** Max allowed hits within the window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export interface IRateLimitResult {
  /** Whether this hit is within the limit. */
  allowed: boolean
  limit: number
  /** Hits left in the current window (0 once the limit is reached). */
  remaining: number
  /** When the current window resets. */
  resetAt: Date
}

/**
 * Fixed-window rate limiter. Each `hit` counts a request against `key`'s current
 * window and reports whether it is allowed. Two implementations are selected by
 * the project runner from `DATABASE_URL`: in-memory (single process) and
 * Postgres (atomic and shared across instances).
 */
export class RateLimiter {
  hit(key: string, options: IRateLimitOptions): Promise<IRateLimitResult> {
    throw new Error('Not implemented')
  }
}
