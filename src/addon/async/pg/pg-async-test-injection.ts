import { Env } from '@/core/env'
import { container, singleton } from '@/core/injection'
import { Pool } from 'pg'
import { PgCrudRepository, PgLocker, PgRepositoryAdapter } from '@/feature/pg'
import { ITestTagRepository, TestTag, TestTagRepository } from '@/feature/async/testAsyncHelpers'
import { RepositoryAdapterRegistry } from '@/feature/repository'
import { Locker } from '@/core/lock'
// Importing the extensions registers the job/cron custom queries for Postgres.
import './CronJobPgQueries'
import './JobPgQueries'

@singleton()
class PgTestTagRepository extends PgCrudRepository<TestTag> implements ITestTagRepository {
  constructor(pool: Pool) {
    super(pool, {
      table: 'tag',
      schema: 'wabot_test',
      constructor: TestTag,
    })
  }

  async findByValue(
    value: string,
    options?: { limit?: number; order?: 'asc' | 'desc' },
  ): Promise<TestTag[]> {
    if (options?.order && options.order !== 'asc' && options.order !== 'desc') {
      throw new Error('Invalid order')
    }

    let sql = `
      SELECT ${this.columns}
      FROM ${this.table} 
      WHERE data @> $1::jsonb
    `
    const queryArgs = [JSON.stringify({ value })]

    if (options?.order) sql = sql + ` ORDER BY created_at ${options.order}`
    if (options?.limit) {
      sql = sql + ` LIMIT $2`
      queryArgs.push(`${options.limit}`)
    }

    const items = await this.query(sql, queryArgs)
    return items
  }
}

const env = container.resolve(Env)
const pool = new Pool({ connectionString: env.requireString('DATABASE_URL'), max: 2 })
container.registerInstance(Pool, pool)
// Job and cron repositories now resolve through the adapter, like any other.
container.resolve(RepositoryAdapterRegistry).setDefault(new PgRepositoryAdapter(pool))
container.registerType(TestTagRepository, PgTestTagRepository)
container.registerType(Locker, PgLocker)
