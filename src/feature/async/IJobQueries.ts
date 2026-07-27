import { Job } from './Job'

/**
 * Custom (non field-equality) queries for `JobRepository`, implemented once per
 * adapter (in-memory + Postgres). Both implementations ship with the framework.
 *
 * They all turn on the same thing the method-name grammar cannot say: a job's
 * state is a combination of three timestamps (`startedAt`, `successAt`,
 * `failedAt`) rather than a single field.
 */
export interface IJobQueries {
  /** Jobs due at or before `date` that have not started, soonest first. */
  findPendingForRunFrom(date: Date, limit: number): Promise<Job[]>
  /** Jobs that started and have neither succeeded nor failed. */
  findRunningJobs(): Promise<Job[]>
  /** How many jobs of a command are running right now. */
  countRunningByCommand(commandName: string): Promise<number>
  /**
   * The most recent job for `dedupKey` that is still running, or succeeded at
   * or after `succeededSinceTimestamp` — the deduplication window.
   */
  findActiveByDedupKey(
    commandName: string,
    dedupKey: string,
    succeededSinceTimestamp: number,
  ): Promise<Job | null>
}
