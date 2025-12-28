import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Lock, LockKey } from '@/core/lock'
import { Job } from './Job'
import { JobRunner } from './JobRunner'
import { Logger } from '@/core/logger'
import { CommandMetadataStore } from './CommandMetadataStore'

@singleton()
export class JobManager {
  static LOOP_INTERVAL_SECONDS = 30
  static RECOVERY_INTERVAL_SECONDS = 300

  private static readonly MAX_CONCURRENT_JOBS = 5
  private logger = new Logger('wabot:job-manager')

  private isRunning = false
  private activeJobs = 0
  private timeout?: NodeJS.Timeout
  private recoveryTimeout?: NodeJS.Timeout

  constructor(
    private lock: Lock,
    private jobRepository: JobRepository,
    private jobRunner: JobRunner,
    private metadataStore: CommandMetadataStore,
  ) {}

  run() {
    if (this.isRunning) return
    this.isRunning = true
    this.scheduleNextTick()
    this.scheduleRecoveryTick()
  }

  stop(): void {
    this.isRunning = false
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = undefined
    }
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout)
      this.recoveryTimeout = undefined
    }
  }

  private scheduleNextTick() {
    if (!this.isRunning) return

    this.timeout = setTimeout(
      () =>
        this.loop().catch((e) => {
          this.logger.error(e)
        }),
      JobManager.LOOP_INTERVAL_SECONDS * 1000,
    )
  }

  private scheduleRecoveryTick() {
    if (!this.isRunning) return

    this.recoveryTimeout = setTimeout(
      () => this.recoverStuckJobs().catch((e) => this.logger.error(e)),
      JobManager.RECOVERY_INTERVAL_SECONDS * 1000,
    )
  }

  private async loop(): Promise<void> {
    try {
      const jobs = await this.jobRepository.findScheduledBefore(new Date())

      await Promise.allSettled(
        jobs.map((job) => this.manageJob(job).catch((e) => this.logger.error(e))),
      )
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.scheduleNextTick()
    }
  }

  private tryAcquireSlot(): boolean {
    if (this.activeJobs >= JobManager.MAX_CONCURRENT_JOBS) {
      return false
    }
    this.activeJobs++
    return true
  }

  private releaseSlot(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1)
  }

  async manageJob(job: Job) {
    let slotAcquired = false

    try {
      const mustRun = await this.lock.withKey(new LockKey(`wabot-job-${job.id}`), async () => {
        if (!this.metadataStore.isCommandHandlerActive(job.commandName)) return false
        if (!job.isScheduleReady()) return false
        if (job.hasStarted()) return false
        if (!this.tryAcquireSlot()) return false
        slotAcquired = true

        job.setAsStarted()
        await this.jobRepository.update(job)
        return true
      })

      if (!mustRun) return

      await this.jobRunner.run(job)
    } catch (e) {
      this.logger.error(e)
    } finally {
      if (slotAcquired) {
        this.releaseSlot()
      }
    }
  }

  private async recoverStuckJobs() {
    const recoveryLockKey = new LockKey('wabot-job-recovery')

    try {
      // Only one process can enter this block at a time
      await this.lock.withKey(recoveryLockKey, async () => {
        this.logger.debug('Recovery lock acquired')

        const jobs = await this.jobRepository.findRunningJobs()
        for (const job of jobs) {
          if (!job.isStuck()) continue

          try {
            this.logger.warn(`Recovering stuck job ${job.id} (running ${job.runningSeconds}s)`)
            job.recover()
            await this.jobRepository.update(job)
          } catch (e) {
            this.logger.error(`Failed to recover job ${job.id}`, e)
          }
        }
      })
    } catch (e) {
      this.logger.error('Recovery process failed', e)
    } finally {
      this.scheduleRecoveryTick()
    }
  }
}
