import { CronJob, CronJobRepository, ICronJobQueries } from '@/feature/async'
import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'

/**
 * In-memory implementation of {@link CronJobRepository}'s custom queries. Ships
 * with the framework and registers itself on import.
 */
@memExtension(CronJobRepository)
export class CronJobMemoryQueries
  extends MemoryRepositoryExtension<CronJob>
  implements ICronJobQueries
{
  findDue = async (date?: Date): Promise<CronJob[]> => {
    const now = (date ?? new Date()).getTime()
    return [...this.items.values()]
      .filter((job) => job['data'].enabled && (job['data'].nextRunAt ?? Infinity) <= now)
      .sort((a, b) => (a['data'].nextRunAt ?? 0) - (b['data'].nextRunAt ?? 0))
      .map((job) => this.clone(job))
  }
}
