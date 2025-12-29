import { singleton } from '@/core/injection'
import { Lock, LockKey } from '@/core/lock'
import { Logger } from '@/core/logger'
import { withPgClient } from '@/feature/pg/withPgClient'
import { Pool, PoolClient } from 'pg'

@singleton()
export class PgLock extends Lock {
  private logger = new Logger('wabot:pg-lock')

  constructor(private readonly pool: Pool) {
    super()
  }

  async withKey<T>(key: LockKey, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return withPgClient(this.pool, async (client) => {
      let locked = false

      try {
        await client.query('SELECT pg_advisory_lock($1)', [key.value])
        locked = true

        return await fn(client)
      } finally {
        if (locked) {
          const res = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock($1) AS unlocked',
            [key.value],
          )

          if (!res.rows[0]?.unlocked) {
            this.logger.error('error - no unlock')
          }
        }
      }
    })
  }

  async tryWithKey<T>(
    key: LockKey,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T | undefined> {
    return withPgClient(this.pool, async (client) => {
      let locked = false

      try {
        const result = await client.query<{ locked: boolean }>(
          'SELECT pg_try_advisory_lock($1) AS locked',
          [key.value],
        )

        locked = result.rows[0]?.locked === true
        if (!locked) return undefined

        return await fn(client)
      } finally {
        if (locked) {
          const res = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock($1) AS unlocked',
            [key.value],
          )

          if (!res.rows[0]?.unlocked) {
            this.logger.error('error - no unlock')
          }
        }
      }
    })
  }
}
