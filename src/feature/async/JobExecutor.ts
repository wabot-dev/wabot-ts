import { singleton } from '@/core/injection'
import { JobRunner } from './JobRunner'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { Job } from './Job'
import { Locker } from '@/core/lock'

@singleton()
export class JobExecutor {
  private activeJobs = 0
  private logger = new Logger('wabot:job-executor')

  constructor(
    private locker: Locker,
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

    try {
      await this.locker.withKey(`wabot-job-${job.id}`).tryRun(async () => {
        const fresh = await this.repo.findOrThrow(job.id)
        if (!fresh.isScheduleReady()) return

        await this.runner.run(fresh)
      })
    } catch (e) {
      this.logger.error(`Job ${job.id} execution error:`, e)
      try {
        const fresh = await this.repo.findOrThrow(job.id)
        if (!fresh.hasFinished()) {
          fresh.setAsFailed(e instanceof Error ? e : new Error('Job execution error'))
          await this.repo.update(fresh)
        }
      } catch (updateError) {
        this.logger.error(`Failed to update job ${job.id} status:`, updateError)
      }
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
