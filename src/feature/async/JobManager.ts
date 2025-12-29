import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Lock, LockKey } from '@/core/lock'
import { Job } from './Job'
import { JobRunner } from './JobRunner'
import { Logger } from '@/core/logger'
import { CommandMetadataStore } from './CommandMetadataStore'
import { Env } from '@/core/env'

@singleton()
export class JobManager {
  private LOOP_INTERVAL_SECONDS
  private RECOVERY_INTERVAL_SECONDS

  private MAX_CONCURRENT_JOBS
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
    private env: Env,
  ) {
    this.LOOP_INTERVAL_SECONDS = this.env.requireNumber('WABOT_JOB_MANAGER_LOOP_INTERVAL_SECONDS', {
      default: 15,
    })
    this.RECOVERY_INTERVAL_SECONDS = this.env.requireNumber(
      'WABOT_JOB_MANAGER_RECOVERY_INTERVAL_SECONDS',
      {
        default: 300,
      },
    )
    this.MAX_CONCURRENT_JOBS = this.env.requireNumber('WABOT_JOB_MANAGER_MAX_CONCURRENT_JOBS', {
      default: 5,
    })
  }

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
      this.LOOP_INTERVAL_SECONDS * 1000,
    )
  }

  private scheduleRecoveryTick() {
    if (!this.isRunning) return

    this.recoveryTimeout = setTimeout(
      () => this.recoverLoop().catch((e) => this.logger.error(e)),
      this.RECOVERY_INTERVAL_SECONDS * 1000,
    )
  }

  private async loop(): Promise<void> {
    this.logger.debug('loop start')
    try {
      const loopLockKey = new LockKey('wabot-job-manager-loop')

      await this.lock.withKey(loopLockKey, async () => {
        const pendingForRunJobs = await this.jobRepository.findPendingForRunFrom(
          new Date(),
          this.remainingSlots(),
        )
        const jobsToRun = pendingForRunJobs.filter((x) => x.isScheduleReady())
        jobsToRun.forEach((x) => this.manageJob(x).catch((e) => this.logger.error(e)))
        await this.waitMs(300)
      })
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.scheduleNextTick()
      this.logger.debug('loop end')
    }
  }

  private remainingSlots() {
    return this.MAX_CONCURRENT_JOBS - this.activeJobs
  }

  private tryAcquireSlot(): boolean {
    if (this.activeJobs >= this.MAX_CONCURRENT_JOBS) {
      return false
    }
    this.activeJobs++
    return true
  }

  private releaseSlot(): void {
    this.activeJobs = Math.max(0, this.activeJobs - 1)
  }

  async manageJob(job: Job) {
    if (!this.metadataStore.isCommandHandlerActive(job.commandName)) return
    if (!this.tryAcquireSlot()) return

    let lockAdquired = false
    const jobLockKey = new LockKey(`wabot-job-${job.id}`)

    try {
      this.logger.debug(`try adquire lock with ${jobLockKey}`)

      return await this.lock.tryWithKey(jobLockKey, async () => {
        lockAdquired = true
        this.logger.debug(`lock adquired with ${jobLockKey}`)

        const locketJob = await this.jobRepository.findOrThrow(job.id)
        if (!locketJob.isScheduleReady()) return

        this.logger.debug(`job ${locketJob.id} is schedule ready`)
        await this.jobRunner.run(locketJob)
        return locketJob
      })
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.releaseSlot()
      if (lockAdquired) {
        this.logger.debug(`realesed lock with ${jobLockKey}`)
      }
    }
  }

  async waitMs(timeoutMs = 100) {
    await new Promise((r) => setTimeout(r, timeoutMs))
  }

  private async recoverLoop() {
    this.logger.debug('recovery loop start')

    const recoveryLoopLockKey = new LockKey('wabot-job-manager-recovery-loop')

    try {
      await this.lock.withKey(recoveryLoopLockKey, async () => {
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
      this.logger.debug('recovery loop end')
    }
  }
}
