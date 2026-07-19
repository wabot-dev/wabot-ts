import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { IRateLimitOptions, IRateLimitResult, RateLimiter } from '@/core/rate-limit'
import { withPgClient } from './withPgClient'

const TABLE = '"_wabot_rate_limit"'

/**
 * Postgres fixed-window rate limiter — atomic and shared across instances. Each
 * window is a distinct bucket row (`key:windowStart`) incremented with a single
 * upsert, so concurrent hits count correctly. Expired buckets are pruned
 * lazily; a periodic `DELETE WHERE expires_at < now()` keeps the table small.
 */
@singleton()
export class PgRateLimiter extends RateLimiter {
  private tableReady = false

  constructor(private readonly pool: Pool) {
    super()
  }

  async hit(key: string, { limit, windowSeconds }: IRateLimitOptions): Promise<IRateLimitResult> {
    await this.ensureTable()

    const windowMs = windowSeconds * 1000
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs
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

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
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
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           bucket TEXT PRIMARY KEY,
           count INT NOT NULL,
           expires_at TIMESTAMPTZ NOT NULL
         )`,
      )
    })
    this.tableReady = true
  }
}
