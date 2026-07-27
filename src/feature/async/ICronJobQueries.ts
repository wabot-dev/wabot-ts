import { CronJob } from './CronJob'

/**
 * Custom (non field-equality) queries for `CronJobRepository`, implemented once
 * per adapter (in-memory + Postgres). Both implementations ship with the
 * framework.
 */
export interface ICronJobQueries {
  /** Enabled jobs whose next run is due at or before `date`, soonest first. */
  findDue(date?: Date): Promise<CronJob[]>
}
