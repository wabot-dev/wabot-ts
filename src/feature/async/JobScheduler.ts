import { singleton } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Env } from '@/core/env'
import { Logger } from '@/core/logger'
import { JobExecutor } from './JobExecutor'
import { Job } from './Job'
import { Locker } from '@/core/lock'

@singleton()
export class JobScheduler {
  private timeout?: NodeJS.Timeout
  private logger = new Logger('wabot:job-scheduler')
  private commands = new Set<string>()
  private running = false

  constructor(
    private locker: Locker,
    private repo: JobRepository,
    private executor: JobExecutor,
    private env: Env,
  ) {}

  start(commands: string[]) {
    commands.forEach((x) => this.commands.add(x))
    for (const command of commands) {
      this.logger.info(`config COMMAND ${command}`)
    }

    if (this.commands.size > 0 && !this.running) {
      this.running = true
      this.tick()
    }
  }

  stop(commands: string[]) {
    this.logger.info(`Stopping job handlers for commands ${commands.join(', ')}`)
    commands.forEach((x) => this.commands.delete(x))
    if (this.commands.size === 0) {
      this.running = false
      if (this.timeout) {
        clearTimeout(this.timeout)
      }
    }
  }

  tryExecuteNow(job: Job) {
    if (this.commands.has(job.commandName))
      this.executor
        .execute(job)
        .catch((e) => this.logger.error(`Failed to execute job ${job.id}`, e))
  }

  private async tick() {
    if (!this.running) return
    const interval = this.env.requireNumber('WABOT_JOB_SCHEDULER_INTERVAL_SECONDS', {
      default: 10,
    })

    try {
      const remainingSlots = this.executor.remainingSlots()
      if (remainingSlots === 0) return

      await this.locker.withKey('wabot-job-scheduler-loop').run(async () => {
        const jobs = await this.repo.findPendingForRunFrom(
          new Date(),
          this.executor.remainingSlots(),
        )

        const readyToRunJobs = jobs.filter(
          (job) => this.commands.has(job.commandName) && job.isScheduleReady(),
        )

        readyToRunJobs.forEach((j) =>
          this.executor
            .execute(j)
            .catch((e) => this.logger.error(`Failed to execute job ${j.id}`, e)),
        )
        await new Promise((r) => setTimeout(r, 10))
      })
    } catch (e) {
      this.logger.error('Job scheduler tick failed', e)
    } finally {
      this.timeout = setTimeout(() => this.tick(), interval * 1000)
    }
  }
}
