import { singleton } from '@/core/injection'
import { CronJob } from '@/feature/async/CronJob'
import { ICronJobRepository } from '@/feature/async/ICronJobRepository'
import { PgCrudRepository } from '@/feature/pg'
import { Pool } from 'pg'

@singleton()
export class PgCronJobRepository extends PgCrudRepository<CronJob> implements ICronJobRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'cron_job',
      constructor: CronJob,
    })
  }

  async findDue(date?: Date): Promise<CronJob[]> {
    date = date ?? new Date()
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data ? 'nextRunAt'
        AND (data->>'nextRunAt')::bigint <= $1
        AND (data->>'enabled')::boolean
      ORDER BY (data->>'nextRunAt')::bigint ASC
    `
    const items = await this.query(sql, [date.getTime()])
    return items
  }

  async findByName(name: string): Promise<CronJob | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table} 
      WHERE data @> $1::jsonb
      LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify({ name })])
    return items[0] ?? null
  }
}
