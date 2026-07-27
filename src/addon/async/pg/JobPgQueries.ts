import { IJobQueries, Job, JobRepository } from '@/feature/async'
import { PgJsonbRepositoryExtension, withPgClient } from '@/feature/pg'
import { dbExtension } from '@/feature/repository'

/**
 * Postgres implementation of {@link JobRepository}'s custom queries. Ships with
 * the framework and registers itself on import.
 */
@dbExtension(JobRepository)
export class JobPgQueries extends PgJsonbRepositoryExtension<Job> implements IJobQueries {
  findPendingForRunFrom = async (date: Date, limit: number): Promise<Job[]> => {
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
    return this.query(sql, [date.getTime(), limit])
  }

  findRunningJobs = async (): Promise<Job[]> => {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data ? 'startedAt'
         AND data->>'startedAt' IS NOT NULL
         AND data->>'successAt' IS NULL
         AND data->>'failedAt' IS NULL
    `
    return this.query(sql, [])
  }

  countRunningByCommand = async (commandName: string): Promise<number> => {
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

  findActiveByDedupKey = async (
    commandName: string,
    dedupKey: string,
    succeededSinceTimestamp: number,
  ): Promise<Job | null> => {
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
}
