import { CrudRepository } from '@/core/repository'
import { queryExtension, repository } from '@/feature/repository'
import { IJobQueries } from './IJobQueries'
import { IJobRepository } from './IJobRepository'
import { Job } from './Job'

/**
 * Job store built on the standard repository pattern, so it works with any
 * registered adapter out of the box: in-memory by default, Postgres when a
 * `DATABASE_URL` is configured (the runner selects the adapter).
 *
 * CRUD and pagination come from the pattern. Every custom query here reads a
 * job's *state*, which is a combination of three timestamps rather than a
 * field, so they delegate to a per-adapter extension (both shipped by the
 * framework — see the *MemoryQueries / *PgQueries).
 */
@repository({ schema: 'wabot', table: 'job', constructor: Job })
export class JobRepository extends CrudRepository<Job, IJobQueries> implements IJobRepository {
  @queryExtension() declare findPendingForRunFrom: (date: Date, limit: number) => Promise<Job[]>

  @queryExtension() declare findRunningJobs: () => Promise<Job[]>

  @queryExtension() declare countRunningByCommand: (commandName: string) => Promise<number>

  @queryExtension() declare findActiveByDedupKey: (
    commandName: string,
    dedupKey: string,
    succeededSinceTimestamp: number,
  ) => Promise<Job | null>
}
