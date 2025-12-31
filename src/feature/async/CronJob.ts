import { CronExpressionParser } from 'cron-parser'
import { Entity, IEntityData } from '@/core/entity'
import { Job } from './Job'

export interface ICronJobData extends IEntityData {
  commandName: string
  commandData: object

  cron: string

  enabled: boolean

  lastRunAt?: number
  nextRunAt: number

  maxRunningJobs?: number
  misfirePolicy?: 'RUN_ONCE' | 'RUN_ALL' | 'SKIP'
  reintentsDelaysInSeconds?: number[]
  aceptableRunningTimeSeconds?: number
  stuckRetryAttempts?: number
}

export class CronJob extends Entity<ICronJobData> {
  get nextRunAt() {
    return new Date(this.data.nextRunAt)
  }

  get lastRunAt() {
    return this.data.lastRunAt ? new Date(this.data.lastRunAt) : null
  }

  get maxConcurrency() {
    return this.data.maxRunningJobs ?? 1
  }

  get misfirePolicy() {
    return this.data.misfirePolicy ?? 'RUN_ONCE'
  }

  get commandName() {
    return this.data.commandName
  }

  isDue(now: Date) {
    return this.data.enabled && this.data.nextRunAt <= now.getTime()
  }

  computeNextRun(from: Date) {
    const interval = CronExpressionParser.parse(this.data.cron, {
      currentDate: from,
    })

    this.data.nextRunAt = interval.next().getTime()
  }

  markAsExecuted(at: Date) {
    this.data.lastRunAt = at.getTime()
    this.computeNextRun(at)
  }

  nextJob(): Job {
    return new Job({
      commandName: this.data.commandName,
      commandData: this.data.commandData,

      scheduledAt: this.data.nextRunAt,

      reintentsDelaysInSeconds: this.data.reintentsDelaysInSeconds,
      aceptableRunningTimeSeconds: this.data.aceptableRunningTimeSeconds,
      stuckRetryAttempts: this.data.stuckRetryAttempts,
    })
  }
}
