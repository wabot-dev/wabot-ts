import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { PgCrudRepository, withPgClient } from '@/feature/pg'
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
        AND (data->>'scheduledAt')::bigint <= $1
        AND data->>'startedAt' IS NULL
        AND data->>'successAt' IS NULL
        AND data->>'failedAt' IS NULL 
      ORDER BY (data->>'scheduledAt')::bigint ASC
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

  async findActiveByDedupKey(
    commandName: string,
    dedupKey: string,
    succeededSinceTimestamp: number,
  ): Promise<Job | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data->>'commandName' = $1
        AND data->>'dedupKey' = $2
        AND data->>'failedAt' IS NULL
        AND (
          data->>'successAt' IS NULL
          OR (data->>'successAt')::bigint >= $3
        )
      ORDER BY (data->>'createdAt')::bigint DESC
      LIMIT 1
    `
    const items = await this.query(sql, [commandName, dedupKey, succeededSinceTimestamp])
    return items[0] ?? null
  }

  async countRunningByCommand(commandName: string): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS count
      FROM ${this.table}
      WHERE data ? 'startedAt'
        AND data->>'startedAt' IS NOT NULL
        AND data->>'successAt' IS NULL
        AND data->>'failedAt' IS NULL
        AND data->>'commandName' = $1
    `

    return withPgClient(this.pool, async (client) => {
      const result = await client.query<{ count: number }>(sql, [commandName])
      return result.rows[0]?.count ?? 0
    })
  }
}
