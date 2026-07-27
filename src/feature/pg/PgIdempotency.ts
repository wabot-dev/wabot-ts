import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { Idempotency } from '@/core/idempotency'
import { withPgClient } from './withPgClient'

const TABLE = '"_wabot_idempotency"'

/**
 * Postgres idempotency store — atomic and safe across instances. A single
 * `INSERT … ON CONFLICT` claims the key: a returned row means it was inserted
 * (first sight) or refreshed after its window elapsed (reprocess), while no row
 * means a still-live duplicate to skip.
 */
@singleton()
export class PgIdempotency extends Idempotency {
  private tableReady = false

  constructor(private readonly pool: Pool) {
    super()
  }

  async alreadyProcessed(key: string, ttlSeconds: number): Promise<boolean> {
    await this.ensureTable()
    return withPgClient(this.pool, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO ${TABLE} (key, expires_at)
              VALUES ($1, now() + ($2 || ' seconds')::interval)
         ON CONFLICT (key) DO UPDATE SET expires_at = EXCLUDED.expires_at
               WHERE ${TABLE}.expires_at < now()
           RETURNING key`,
        [key, String(ttlSeconds)],
      )
      return rows.length === 0
    })
  }

  async forget(key: string): Promise<void> {
    await this.ensureTable()
    await withPgClient(this.pool, (client) =>
      client.query(`DELETE FROM ${TABLE} WHERE key = $1`, [key]),
    )
  }

  private async ensureTable(): Promise<void> {
    if (this.tableReady) return
    await withPgClient(this.pool, async (client) => {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           key TEXT PRIMARY KEY,
           expires_at TIMESTAMPTZ NOT NULL
         )`,
      )
    })
    this.tableReady = true
  }
}
