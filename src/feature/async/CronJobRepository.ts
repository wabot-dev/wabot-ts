import { CrudRepository } from '@/core/repository'
import { query, queryExtension, repository } from '@/feature/repository'
import { CronJob } from './CronJob'
import { ICronJobQueries } from './ICronJobQueries'
import { ICronJobRepository } from './ICronJobRepository'

/**
 * Cron job store built on the standard repository pattern, so it works with any
 * registered adapter out of the box: in-memory by default, Postgres when a
 * `DATABASE_URL` is configured (the runner selects the adapter).
 *
 * CRUD and the by-name lookup come from the pattern. `findDue` compares a
 * timestamp and filters on a flag, which the method-name grammar cannot
 * express, so it delegates to a per-adapter extension (both shipped by the
 * framework — see the *MemoryQueries / *PgQueries).
 */
@repository({ schema: 'wabot', table: 'cron_job', constructor: CronJob })
export class CronJobRepository
  extends CrudRepository<CronJob, ICronJobQueries>
  implements ICronJobRepository
{
  @query() declare findOneByName: (name: string) => Promise<CronJob | null>

  @queryExtension() declare findDue: (date?: Date) => Promise<CronJob[]>
}
