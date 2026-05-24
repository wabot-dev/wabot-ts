import { singleton } from '@/core/injection'
import { CustomError } from '@/core/error'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { Job } from './Job'
import { JobRepository } from './JobRepository'
import { JobScheduler } from './JobScheduler'
import { IValidateInputShape, validateAndTransform } from '@/core/validation'
import { IConstructor } from '@/core/generics'
import { Locker } from '@/core/lock'
import { computeDedupKey } from './computeDedupKey'

export type IScheduleDelay =
  | { seconds: number }
  | { minutes: number }
  | { hours: number }
  | { days: number }

export type IScheduleAt = Date | IScheduleDelay

@singleton()
export class Async {
  constructor(
    private jobRepository: JobRepository,
    private metadataStore: AsyncMetadataStore,
    private jobScheduler: JobScheduler,
    private locker: Locker,
  ) {}

  async runCommand<T>(ctor: IConstructor<T>, data: IValidateInputShape<T>): Promise<Job> {
    const job = await this.scheduleCommand(ctor, data, new Date())
    this.jobScheduler.tryExecuteNow(job)
    return job
  }

  async scheduleCommand<T>(
    ctor: IConstructor<T>,
    data: IValidateInputShape<T>,
    scheduledAt: IScheduleAt,
  ): Promise<Job> {
    const commandName = this.metadataStore.getCommandName(ctor)
    if (!commandName) {
      throw new Error(`${ctor.name} is not registered as command`)
    }

    const { error, value: commandData } = validateAndTransform(data, ctor)

    if (error) {
      throw new CustomError({
        message: `Validation failed: ${error.description}`,
        info: error,
      })
    }

    const scheduledDate = this.resolveScheduledDate(scheduledAt)
    const options = this.metadataStore.getJobOptionsForCommandName(commandName)
    const dedupConfig = this.metadataStore.getDedupConfigForCommandName(commandName)

    const buildJob = (dedupKey?: string) =>
      new Job({
        commandName,
        commandData,
        scheduledAt: scheduledDate.getTime(),
        reintentsDelaysInSeconds: options.reintentsDelaysInSeconds,
        aceptableRunningTimeSeconds: options.aceptableRunningTimeSeconds,
        stuckRetryAttempts: options.stuckRetryAttempts,
        dedupKey,
      })

    if (!dedupConfig) {
      const job = buildJob()
      await this.jobRepository.create(job)
      return job
    }

    const dedupKey = computeDedupKey(commandData)
    const succeededSinceTimestamp =
      dedupConfig === 'forever' ? 0 : Date.now() - dedupConfig.windowSeconds * 1000

    return await this.locker
      .withKey(`wabot-async-dedup-${commandName}-${dedupKey}`)
      .run(async () => {
        const existing = await this.jobRepository.findActiveByDedupKey(
          commandName,
          dedupKey,
          succeededSinceTimestamp,
        )
        if (existing) return existing

        const job = buildJob(dedupKey)
        await this.jobRepository.create(job)
        return job
      })
  }

  private resolveScheduledDate(scheduledAt: IScheduleAt): Date {
    if (scheduledAt instanceof Date) {
      return scheduledAt
    }

    const now = new Date()

    if ('seconds' in scheduledAt) {
      return new Date(now.getTime() + scheduledAt.seconds * 1000)
    }
    if ('minutes' in scheduledAt) {
      return new Date(now.getTime() + scheduledAt.minutes * 60 * 1000)
    }
    if ('hours' in scheduledAt) {
      return new Date(now.getTime() + scheduledAt.hours * 60 * 60 * 1000)
    }
    if ('days' in scheduledAt) {
      return new Date(now.getTime() + scheduledAt.days * 24 * 60 * 60 * 1000)
    }

    throw new Error('Invalid schedule delay format')
  }
}
