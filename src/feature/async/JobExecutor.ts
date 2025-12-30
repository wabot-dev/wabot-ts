import { singleton } from '@/core/injection'
import { Lock, LockKey } from '@/core/lock'
import { JobRunner } from './JobRunner'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { Job } from './Job'

@singleton()
export class JobExecutor {
  private activeJobs = 0
  private logger = new Logger('wabot:job-executor')

  constructor(
    private lock: Lock,
    private runner: JobRunner,
    private repo: JobRepository,
    private env: Env,
  ) {}

  remainingSlots() {
    const max = this.env.requireNumber('WABOT_JOB_EXECUTOR_MAX_CONCURRENT_JOBS', { default: 5 })
    return max - this.activeJobs
  }

  async execute(job: Job) {
    if (!this.tryAcquire()) return

    const key = new LockKey(`wabot-job-${job.id}`)

    try {
      await this.lock.tryWithKey(key, async () => {
        const fresh = await this.repo.findOrThrow(job.id)
        if (!fresh.isScheduleReady()) return

        await this.runner.run(fresh)
      })
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.release()
    }
  }

  private tryAcquire(): boolean {
    if (this.remainingSlots() <= 0) return false
    this.activeJobs++
    return true
  }

  private release() {
    this.activeJobs = Math.max(0, this.activeJobs - 1)
  }
}
