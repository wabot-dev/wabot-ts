import { CronJob, CronJobRepository, ICronJobQueries } from '@/feature/async'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { dbExtension } from '@/feature/repository'

/**
 * Postgres implementation of {@link CronJobRepository}'s custom queries. Ships
 * with the framework and registers itself on import.
 */
@dbExtension(CronJobRepository)
export class CronJobPgQueries
  extends PgJsonbRepositoryExtension<CronJob>
  implements ICronJobQueries
{
  findDue = async (date?: Date): Promise<CronJob[]> => {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data ? 'nextRunAt'
         AND (data->>'nextRunAt')::bigint <= $1
         AND (data->>'enabled')::boolean
       ORDER BY (data->>'nextRunAt')::bigint ASC
    `
    return this.query(sql, [(date ?? new Date()).getTime()])
  }
}
