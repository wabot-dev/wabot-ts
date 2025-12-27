import { Lock, LockKey } from '@/core/lock'
import { Pool, PoolClient } from 'pg'

export class PgLock extends Lock {
  private readonly pool: Pool

  constructor(pool: Pool) {
    super()
    this.pool = pool
  }

  async withKey<T>(key: LockKey, fn: () => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect()
    try {
      await client.query('SELECT pg_advisory_lock($1)', [key.value])
      return await fn()
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key.value])
      client.release()
    }
  }

  async tryWithKey<T>(key: LockKey, fn: () => Promise<T>): Promise<T | undefined> {
    const client: PoolClient = await this.pool.connect()
    try {
      const result = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [key.value],
      )

      if (!result.rows[0].locked) return undefined

      return await fn()
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key.value])
      client.release()
    }
  }
}
