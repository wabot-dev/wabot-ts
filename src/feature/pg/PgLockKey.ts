import { ILockKey } from '@/core/lock/ILockKey'
import { Logger } from '@/core/logger'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { withPgClient } from './withPgClient'

export class PgLockKey implements ILockKey {
  readonly value: bigint
  private logger = new Logger('wabot:pg-lock-key')

  constructor(
    private readonly key: string | number,
    private pool: Pool,
  ) {
    this.value = typeof key === 'number' ? BigInt(key) : PgLockKey.hashString(key)
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return withPgClient(this.pool, async (client) => {
      let locked = false
      try {
        this.logger.debug(`try to adquire ${this.key}`)
        await client.query('SELECT pg_advisory_lock($1)', [this.value])
        this.logger.debug(`adquired ${this.key}`)

        locked = true

        return await fn()
      } finally {
        if (locked) {
          this.logger.debug(`try to release ${this.key}`)

          const res = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock($1) AS unlocked',
            [this.value],
          )

          if (!res.rows[0]?.unlocked) {
            this.logger.error('error - no unlock')
          } else {
            this.logger.debug(`released ${this.key}`)
          }
        }
      }
    })
  }

  async tryRun<T>(fn: () => Promise<T>): Promise<T | undefined> {
    return withPgClient(this.pool, async (client) => {
      let locked = false
      try {
        const result = await client.query<{ locked: boolean }>(
          'SELECT pg_try_advisory_lock($1) AS locked',
          [this.value],
        )

        locked = result.rows[0]?.locked === true
        if (!locked) return undefined

        return await fn()
      } finally {
        if (locked) {
          const res = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock($1) AS unlocked',
            [this.value],
          )

          if (!res.rows[0]?.unlocked) {
            this.logger.error('error - no unlock')
          }
        }
      }
    })
  }

  toString(): string {
    return `PgLockKey(${String(this.key)})`
  }

  private static hashString(key: string): bigint {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 15)
    return BigInt('0x' + hash)
  }
}
