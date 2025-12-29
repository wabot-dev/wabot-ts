import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { PgCrudRepository } from '@/feature/pg'
import { IJobRepository, Job } from '@/feature/async'

@singleton()
export class PgJobRepository extends PgCrudRepository<Job> implements IJobRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'job',
      constructor: Job,
    })
  }

  async findPendingForRunFrom(date: Date, limit: number): Promise<Job[]> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data ? 'scheduledAt'
        AND data->>'scheduledAt' <= $1
        AND data->>'startedAt' IS NULL
        AND data->>'successAt' IS NULL
        AND data->>'failedAt' IS NULL 
      ORDER BY data->>'scheduledAt' ASC
      LIMIT $2
    `
    const items = await this.query(sql, [date.getTime(), limit])
    return items
  }

  async findRunningJobs(): Promise<Job[]> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data ? 'startedAt'
        AND data->>'startedAt' IS NOT NULL
        AND data->>'successAt' IS NULL
        AND data->>'failedAt' IS NULL
    `

    const items = await this.query(sql, [])
    return items
  }
}
