import { Pool } from 'pg'
import { withPgClient, withPgTransaction } from '@/feature/pg'
import { ITransactionAdapter } from '@/feature/async'

export class PgTransactionAdapter implements ITransactionAdapter {
  constructor(private pool: Pool) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return withPgClient(this.pool, () =>
      withPgTransaction(this.pool, async () => {
        return await fn()
      }),
    )
  }
}
