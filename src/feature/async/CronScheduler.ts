import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Logger } from '@/core/logger'
import { Lock, LockKey } from '@/core/lock'
import { CronJob } from './CronJob'
import { CronJobRepository } from './CronJobRepository'

@singleton()
export class CronScheduler {
  private running = false
  private timeout?: NodeJS.Timeout

  constructor(
    private lock: Lock,
    private cronRepo: CronJobRepository,
    private jobRepo: JobRepository,
    private logger: Logger,
  ) {}

  run() {
    if (this.running) return
    this.running = true
    this.tick()
  }

  stop() {
    this.running = false
    if (this.timeout) clearTimeout(this.timeout)
  }

  private async tick() {
    const lockKey = new LockKey('wabot-cron-scheduler')

    try {
      await this.lock.withKey(lockKey, async () => {
        const now = new Date()
        const dueCrons = await this.cronRepo.findDue(now)

        for (const cron of dueCrons) {
          await this.spawnJobs(cron)
        }
      })
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.timeout = setTimeout(() => this.tick(), 10_000)
    }
  }

  private async spawnJobs(cron: CronJob) {
    const cronLockKey = new LockKey(`wabot-cron-${cron.id}`)

    await this.lock.tryWithKey(cronLockKey, async () => {
      let now = new Date()
      const fresh = await this.cronRepo.findOrThrow(cron.id)
      if (!fresh.isDue(now)) return

      // ---- Overlap prevention ----
      const running = await this.jobRepo.countRunningByCommand(fresh.commandName)

      if (running >= fresh.maxConcurrency) {
        this.logger.debug(`Cron ${fresh.id} skipped (running ${running}/${fresh.maxConcurrency})`)
        return
      }

      // ---- Misfire handling ----
      now = new Date()
      let executions = 0

      while (fresh.isDue(now)) {
        executions++

        await this.jobRepo.create(fresh.nextJob())
        fresh.markAsExecuted(now)

        if (fresh.misfirePolicy === 'RUN_ONCE') break
        if (fresh.misfirePolicy === 'SKIP') {
          fresh.computeNextRun(now)
          break
        }

        // Safety guard (never infinite)
        if (executions >= 10) {
          this.logger.warn(`Cron ${fresh.id} reached max misfire executions`)
          break
        }
      }

      await this.cronRepo.update(fresh)

      this.logger.info(
        `Cron ${fresh.id} spawned ${executions} job(s), next at ${fresh.nextRunAt.toISOString()}`,
      )
    })
  }
}
