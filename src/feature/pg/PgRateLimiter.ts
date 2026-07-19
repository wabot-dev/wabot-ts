import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { IRateLimitOptions, IRateLimitResult, RateLimiter } from '@/core/rate-limit'
import { withPgClient } from './withPgClient'

const TABLE = '"_wabot_rate_limit"'
const PRUNE_THRESHOLD = 1000

/**
 * Postgres fixed-window rate limiter — atomic and shared across instances. Each
 * window is a distinct bucket row (`key:windowStart`) incremented with a single
 * upsert, so concurrent hits count correctly. Expired buckets are pruned
 * lazily; a periodic `DELETE WHERE expires_at < now()` keeps the table small.
 *
 * Once a key is over its limit, further hits are rejected in-process (a local
 * "blocked until the window resets" cache) so a flood of rejected requests does
 * not keep writing to the DB or growing the shared counter. The table is
 * UNLOGGED (no WAL) since rate-limit state is disposable — worst case a restart
 * resets a window early. This is app-level fairness / cost control, not a DoS
 * shield; reject floods at the edge (nginx / gateway / CDN).
 */
@singleton()
export class PgRateLimiter extends RateLimiter {
  private tableReady = false
  private readonly blockedUntil = new Map<string, number>() // key -> epoch ms

  constructor(private readonly pool: Pool) {
    super()
  }

  async hit(key: string, { limit, windowSeconds }: IRateLimitOptions): Promise<IRateLimitResult> {
    const now = Date.now()
    this.pruneBlockedIfLarge(now)

    // Known-blocked for the current window: reject without a DB round-trip.
    const blockedUntil = this.blockedUntil.get(key)
    if (blockedUntil !== undefined && now < blockedUntil) {
      return { allowed: false, limit, remaining: 0, resetAt: new Date(blockedUntil) }
    }

    await this.ensureTable()

    const windowMs = windowSeconds * 1000
    const windowStart = Math.floor(now / windowMs) * windowMs
    const resetAt = new Date(windowStart + windowMs)
    const bucket = `${key}:${windowStart}`

    const count = await withPgClient(this.pool, async (client) => {
      const { rows } = await client.query<{ count: number }>(
        `INSERT INTO ${TABLE} (bucket, count, expires_at)
              VALUES ($1, 1, $2)
         ON CONFLICT (bucket) DO UPDATE SET count = ${TABLE}.count + 1
           RETURNING count`,
        [bucket, resetAt],
      )
      return rows[0].count
    })

    const allowed = count <= limit
    // Latch/clear the local block so the next flood hit short-circuits.
    if (allowed) this.blockedUntil.delete(key)
    else this.blockedUntil.set(key, resetAt.getTime())

    return {
      allowed,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    }
  }

  private pruneBlockedIfLarge(now: number): void {
    if (this.blockedUntil.size < PRUNE_THRESHOLD) return
    for (const [key, until] of this.blockedUntil) {
      if (until <= now) this.blockedUntil.delete(key)
    }
  }

  /** Remove expired buckets. Call periodically (e.g. from a cron) to bound the table. */
  async pruneExpired(): Promise<void> {
    await this.ensureTable()
    await withPgClient(this.pool, (client) =>
      client.query(`DELETE FROM ${TABLE} WHERE expires_at < now()`),
    )
  }

  private async ensureTable(): Promise<void> {
    if (this.tableReady) return
    await withPgClient(this.pool, async (client) => {
      await client.query(
        `CREATE UNLOGGED TABLE IF NOT EXISTS ${TABLE} (
           bucket TEXT PRIMARY KEY,
           count INT NOT NULL,
           expires_at TIMESTAMPTZ NOT NULL
         )`,
      )
    })
    this.tableReady = true
  }
}
