import { Env } from '@/core/env'
import { container, singleton } from '@/core/injection'
import { JobRepository } from '@/feature/async'
import { Pool } from 'pg'
import { PgJobRepository } from './PgJobRepository'
import { PgCrudRepository, PgLocker } from '@/feature/pg'
import { ITestTagRepository, TestTag, TestTagRepository } from '@/feature/async/testAsyncHelpers'
import { CronJobRepository } from '@/feature/async/CronJobRepository'
import { PgCronJobRepository } from './PgCronJobRepository'
import { Locker } from '@/core/lock'

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
container.registerInstance(
  Pool,
  new Pool({ connectionString: env.requireString('DATABASE_URL'), max: 2 }),
)
container.registerType(JobRepository, PgJobRepository)
container.registerType(CronJobRepository, PgCronJobRepository)
container.registerType(TestTagRepository, PgTestTagRepository)
container.registerType(Locker, PgLocker)
