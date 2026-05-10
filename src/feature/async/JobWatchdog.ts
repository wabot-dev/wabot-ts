import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { Locker } from '@/core/lock'

@singleton()
export class JobWatchdog {
  private timeout?: ReturnType<typeof setTimeout>
  private logger = new Logger('wabot:job-watchdog')
  private commands = new Set<string>()
  private running = false

  constructor(
    private locker: Locker,
    private repo: JobRepository,
    private env: Env,
  ) {}

  start(commands: string[]) {
    commands.forEach((x) => this.commands.add(x))
    if (this.commands.size > 0 && !this.running) {
      this.running = true
      this.tick()
    }
  }

  stop(commands: string[]) {
    commands.forEach((x) => this.commands.delete(x))
    if (this.commands.size === 0) {
      this.running = false
      if (this.timeout) clearTimeout(this.timeout)
    }
  }

  private async tick() {
    if (!this.running) return
    const interval = this.env.requireNumber('WABOT_JOB_WATCHDOG_INTERVAL_SECONDS', {
      default: 300,
    })

    try {
      await this.locker.withKey('wabot-job-watchdog-loop').run(async () => {
        const jobs = await this.repo.findRunningJobs()

        for (const job of jobs) {
          if (!job.isStuck() || !this.commands.has(job.commandName)) continue

          try {
            this.logger.warn(`Recovering stuck job ${job.id}`)
            job.recover()
            await this.repo.update(job)
          } catch (e) {
            this.logger.error(`Failed to recover job ${job.id}`, e)
          }
        }
      })
    } catch (e) {
      this.logger.error('Recovery process failed', e)
    } finally {
      this.timeout = setTimeout(() => this.tick(), interval * 1000)
    }
  }
}
