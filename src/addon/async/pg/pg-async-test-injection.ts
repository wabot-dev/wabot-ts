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

  async findByValue(value: string): Promise<TestTag[]> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table} 
      WHERE data @> $1::jsonb
    `
    const items = await this.query(sql, [JSON.stringify({ value })])
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
