import { singleton } from '@/core/injection'
import { Lock, LockKey } from '@/core/lock'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'

@singleton()
export class JobWatchdog {
  private timeout?: NodeJS.Timeout
  private logger = new Logger('wabot:job-watchdog')
  private commands = new Set<string>()

  constructor(
    private lock: Lock,
    private repo: JobRepository,
    private env: Env,
  ) {}

  start(commands: string[]) {
    commands.forEach((x) => this.commands.add(x))
    if (this.commands.size > 0) this.tick()
  }

  stop(commands: string[]) {
    commands.forEach((x) => this.commands.delete(x))
    if (this.commands.size === 0 && this.timeout) clearTimeout(this.timeout)
  }

  private async tick() {
    const interval = this.env.requireNumber('WABOT_JOB_WATCHDOG_INTERVAL_SECONDS', {
      default: 300,
    })

    try {
      await this.lock.withKey(new LockKey('wabot-job-watchdog-loop'), async () => {
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
