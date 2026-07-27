import { IJobQueries, Job, JobRepository } from '@/feature/async'
import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'

/** A job that started and has not finished either way. */
function isRunning(job: Job): boolean {
  const data = job['data']
  if (data.successAt != null || data.failedAt != null) return false
  return data.scheduledAt != null && data.startedAt != null
}

/**
 * In-memory implementation of {@link JobRepository}'s custom queries. Ships
 * with the framework and registers itself on import.
 */
@memExtension(JobRepository)
export class JobMemoryQueries extends MemoryRepositoryExtension<Job> implements IJobQueries {
  findPendingForRunFrom = async (date: Date, limit: number): Promise<Job[]> => {
    const now = date.getTime()
    return [...this.items.values()]
      .filter((job) => {
        const data = job['data']
        return (
          data.scheduledAt != null &&
          data.scheduledAt <= now &&
          data.startedAt == null &&
          data.successAt == null &&
          data.failedAt == null
        )
      })
      .sort((a, b) => (a['data'].scheduledAt ?? 0) - (b['data'].scheduledAt ?? 0))
      .slice(0, limit)
      .map((job) => this.clone(job))
  }

  findRunningJobs = async (): Promise<Job[]> => {
    return [...this.items.values()].filter(isRunning).map((job) => this.clone(job))
  }

  countRunningByCommand = async (commandName: string): Promise<number> => {
    let count = 0
    for (const job of this.items.values()) {
      if (job['data'].commandName === commandName && isRunning(job)) count++
    }
    return count
  }

  findActiveByDedupKey = async (
    commandName: string,
    dedupKey: string,
    succeededSinceTimestamp: number,
  ): Promise<Job | null> => {
    const candidates = [...this.items.values()]
      .filter((job) => {
        const data = job['data']
        if (data.commandName !== commandName) return false
        if (data.dedupKey !== dedupKey) return false
        if (data.failedAt != null) return false
        if (data.successAt != null && data.successAt < succeededSinceTimestamp) return false
        return true
      })
      .sort((a, b) => (b['data'].createdAt ?? 0) - (a['data'].createdAt ?? 0))
    const found = candidates[0]
    return found ? this.clone(found) : null
  }
}
