import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { Lock, LockKey } from '@/core/lock'
import { JobExecutor } from './JobExecutor'
import { Job } from './Job'

@singleton()
export class JobScheduler {
  private timeout?: NodeJS.Timeout
  private logger = new Logger('wabot:job-scheduler')
  private commands = new Set<string>()
  private running = false

  constructor(
    private lock: Lock,
    private repo: JobRepository,
    private executor: JobExecutor,
    private env: Env,
  ) {}

  start(commands: string[]) {
    commands.forEach((x) => this.commands.add(x))
    if (this.commands.size > 0 && !this.running) this.tick()
  }

  stop(command: string[]) {
    command.forEach((x) => this.commands.delete(x))
    if (this.commands.size === 0) {
      this.running = false
      if (this.timeout) {
        clearTimeout(this.timeout)
      }
    }
  }

  tryExecuteNow(job: Job) {
    if (this.commands.has(job.commandName))
      this.executor.execute(job).catch((e) => this.logger.error(e))
  }

  private async tick() {
    if (!this.running) return
    const interval = this.env.requireNumber('WABOT_JOB_SCHEDULER_INTERVAL_SECONDS', {
      default: 10,
    })

    try {
      const remainingSlots = this.executor.remainingSlots()
      if (remainingSlots === 0) return

      await this.lock.withKey(new LockKey('wabot-scheduler-loop'), async () => {
        const jobs = await this.repo.findPendingForRunFrom(
          new Date(),
          this.executor.remainingSlots(),
        )

        const readyToRunJobs = jobs.filter(
          (job) => this.commands.has(job.commandName) && job.isScheduleReady(),
        )

        readyToRunJobs.forEach((j) => this.executor.execute(j).catch((e) => this.logger.error(e)))
        await new Promise((r) => setTimeout(r, 10))
      })
    } catch (e) {
      this.logger.error(e)
    } finally {
      this.timeout = setTimeout(() => this.tick(), interval * 1000)
    }
  }
}
