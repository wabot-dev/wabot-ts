import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Logger } from '@/core/logger'
import { Lock, LockKey } from '@/core/lock'
import { CronJob } from './CronJob'
import { CronJobRepository } from './CronJobRepository'
import { JobScheduler } from './JobScheduler'
import { ICronJobScheduleConfig } from './ICronJobScheduleConfig'

@singleton()
export class CronScheduler {
  private running = false
  private timeout?: NodeJS.Timeout
  private configuredCrons = new Map<string, ICronJobScheduleConfig & { reconciliated?: boolean }>()

  constructor(
    private lock: Lock,
    private cronRepo: CronJobRepository,
    private jobRepo: JobRepository,
    private logger: Logger,
    private jobScheduler: JobScheduler,
  ) {}

  start(crons: ICronJobScheduleConfig[]) {
    crons.forEach((x) => this.configuredCrons.set(x.name, x))
    if (this.configuredCrons.size > 0 && !this.running) {
      this.running = true
      this.tick()
    }
    if (this.running) this.reconciliation()
  }

  stop(crons: ICronJobScheduleConfig[]) {
    crons.forEach((x) => this.configuredCrons.delete(x.name))
    if (this.configuredCrons.size === 0) {
      this.running = false
      if (this.timeout) clearTimeout(this.timeout)
    }
  }

  private async reconciliation() {
    const configToReconciliate = Array.from(this.configuredCrons.values()).filter(
      (x) => !x.reconciliated,
    )
    this.logger.debug(
      `start reconciliation of crons ${configToReconciliate.map((x) => x.name).join(', ')}`,
    )

    try {
      const cronJobs = await Promise.all(
        configToReconciliate.map((x) => this.reconciliateConfig(x)),
      )
      this.jobScheduler.start(cronJobs.map((x) => x.commandName))
    } catch (e) {
      this.logger.error(e)
      this.stop(configToReconciliate)
      this.logger.error(
        `reconciliation fail - stopped crons ${configToReconciliate.map((x) => x.name).join(', ')}`,
      )
      throw e
    }
  }

  private async tick() {
    const lockKey = new LockKey('wabot-cron-scheduler')

    try {
      await this.lock.withKey(lockKey, async () => {
        const now = new Date()
        const dueCrons = await this.cronRepo.findDue(now)

        const readyToRunCrons = dueCrons.filter(
          (x) => x.isDue(now) && this.configuredCrons.get(x.name)?.reconciliated,
        )

        for (const cron of readyToRunCrons) {
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
        `Cron ${fresh.id} spawned ${executions} job(s), next at ${fresh.nextRunAt!.toISOString()}`,
      )
    })
  }

  private async reconciliateConfig(config: ICronJobScheduleConfig & { reconciliated?: boolean }) {
    const configLockKey = new LockKey(`wabot-cron-config-${config.name}`)

    return await this.lock.withKey(configLockKey, async () => {
      let cronJob = await this.cronRepo.findByName(config.name)
      if (cronJob) {
        cronJob.update({ cron: config.cron, enabled: config.enabled })
        await this.cronRepo.update(cronJob)
      } else {
        cronJob = new CronJob({
          name: config.name,
          cron: config.cron,
          commandName: config.commandName,
          enabled: config.enabled,
        })
        await this.cronRepo.create(cronJob)
      }
      config.reconciliated = true
      return cronJob
    })
  }
}
