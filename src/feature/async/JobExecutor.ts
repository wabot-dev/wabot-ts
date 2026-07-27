import { singleton } from '@/core/injection'
import { JobRunner } from './JobRunner'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { ILogContext, Logger, runWithLogContext } from '@/core/logger'
import { setAuditActor, setAuditSource } from '@/core/audit'
import { addCount, withSpan } from '@/core/observability'
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

  /**
   * Wait for in-flight jobs to finish, up to `timeoutMs`. Used during graceful
   * shutdown after the scheduler has stopped picking up new work, so no new
   * jobs start while draining. Returns once nothing is running or the timeout
   * elapses (the stuck jobs are left for the watchdog to reclaim on restart).
   */
  async drain(timeoutMs: number): Promise<void> {
    if (this.activeJobs === 0) return
    this.logger.info(`Waiting for ${this.activeJobs} in-flight job(s) to finish`)

    const start = Date.now()
    while (this.activeJobs > 0) {
      if (Date.now() - start >= timeoutMs) {
        this.logger.warn(`Job drain timed out with ${this.activeJobs} job(s) still running`)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    this.logger.info('All in-flight jobs finished')
  }

  async execute(job: Job) {
    if (!this.tryAcquire()) return

    // Restore the dispatch-time correlation id when present, so async work stays
    // correlated; otherwise a fresh one is generated.
    const contextFields: ILogContext = { jobId: job.id, command: job.commandName }
    if (job.requestId) contextFields.requestId = job.requestId

    await runWithLogContext(contextFields, () => {
      // Attribute audited changes to the actor that dispatched the command; the
      // command itself is provenance, not the actor.
      if (job.actor) setAuditActor(job.actor)
      setAuditSource(`command:${job.commandName}`)
      return withSpan('job', { 'wabot.command': job.commandName }, async () => {
        addCount('wabot.jobs.executed', 1, { command: job.commandName })
        try {
          await this.locker.withKey(`wabot-job-${job.id}`).tryRun(async () => {
            const fresh = await this.repo.findOrThrow(job.id)
            if (!fresh.isScheduleReady()) return

            await this.runner.run(fresh)
          })
        } catch (e) {
          addCount('wabot.jobs.failed', 1, { command: job.commandName })
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
      })
    })
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
