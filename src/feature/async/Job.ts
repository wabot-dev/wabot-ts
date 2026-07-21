import { IAuditActor } from '@/core/audit'
import { Entity, IEntityData } from '@/core/entity'
import { errorToPlainObject } from '@/core/error'

export interface IJobData extends IEntityData {
  commandName: string
  commandData: any
  /** The actor that dispatched this command, carried across the async boundary for auditing. */
  actor?: IAuditActor
  /** The dispatch-time correlation id, so async work stays correlated in logs/audit. */
  requestId?: string
  scheduledAt?: number
  startedAt?: number
  successAt?: number
  failedAt?: number
  retryAt?: number
  reintentsDelaysInSeconds?: number[]
  intentNumber?: number
  error?: {
    time: number
    message: string
    stack?: string
    info?: any
  }
  aceptableRunningTimeSeconds?: number
  stuckRetryAttempts?: number
  dedupKey?: string
}

export class Job extends Entity<IJobData> {
  get commandName() {
    return this.data.commandName
  }

  get commandData() {
    return this.data.commandData
  }

  get reintentsDelaysInSeconds() {
    return this.data.reintentsDelaysInSeconds
  }

  get aceptableRunningTimeSeconds() {
    return this.data.aceptableRunningTimeSeconds
  }

  get stuckRetryAttempts() {
    return this.data.stuckRetryAttempts
  }

  get dedupKey() {
    return this.data.dedupKey
  }

  get actor() {
    return this.data.actor
  }

  get requestId() {
    return this.data.requestId
  }

  get runningSeconds() {
    if (!this.isRunning()) return -1

    const now = new Date().getTime()
    return (now - this.data.startedAt!) / 1000
  }

  get successAt() {
    return this.data.successAt != null ? new Date(this.data.successAt) : undefined
  }

  get failedAt() {
    return this.data.failedAt != null ? new Date(this.data.failedAt) : undefined
  }

  get scheduledAt() {
    return this.data.scheduledAt != null ? new Date(this.data.scheduledAt) : undefined
  }

  get intentNumber() {
    return this.data.intentNumber ?? 0
  }

  wasSuccess() {
    return this.successAt != null
  }

  wasFailed() {
    return this.data.failedAt != null
  }

  hasFinished() {
    return this.wasSuccess() || this.wasFailed()
  }

  isRunning() {
    return (
      !this.hasFinished() &&
      this.data.scheduledAt != null &&
      this.data.startedAt != null &&
      this.data.startedAt >= this.data.scheduledAt &&
      this.data.startedAt <= new Date().getTime() &&
      this.data.intentNumber != null
    )
  }

  isScheduleReady() {
    return (
      !this.hasFinished() &&
      !this.isRunning() &&
      this.data.scheduledAt != null &&
      this.data.scheduledAt <= new Date().getTime()
    )
  }

  isStuck() {
    return this.runningSeconds > (this.data.aceptableRunningTimeSeconds ?? 15)
  }

  setAsStarted() {
    if (!this.isScheduleReady())
      throw new Error(`job ${this.id} can't be started without ready schedule`)

    this.data.startedAt = new Date().getTime()
    this.data.intentNumber = this.data.intentNumber == null ? 0 : this.data.intentNumber + 1
  }

  setAsSuccess() {
    if (this.hasFinished())
      throw new Error(`job ${this.id} Can't be set as success because has be finished previously`)
    if (!this.isRunning())
      throw new Error(`job ${this.id} can't be set as success because is no running`)
    this.data.successAt = new Date().getTime()
  }

  setAsFailed(error: Error) {
    if (this.hasFinished())
      throw new Error(`job ${this.id} Can't be set as failed because has be finished previously`)

    const now = new Date().getTime()

    const { name: _name, message, stack, ...extra } = errorToPlainObject(error)
    this.data.error = {
      time: now,
      message,
      stack,
      info: Object.keys(extra).length > 0 ? extra : undefined,
    }

    const intentNumber = this.data.intentNumber ?? 0
    const currentReintentDelay = (this.data.reintentsDelaysInSeconds ?? []).at(intentNumber)

    if (currentReintentDelay == null) {
      this.data.failedAt = now
    } else {
      this.data.intentNumber = intentNumber + 1
      this.data.scheduledAt = now + currentReintentDelay * 1000
      this.data.startedAt = undefined
    }
  }

  recover() {
    if (!this.isStuck()) throw new Error(`job ${this.id} Can't be recovered because is not stuck`)

    const now = Date.now()

    this.data.intentNumber = (this.data.intentNumber ?? 0) + 1

    const configuredAttempts = this.data.stuckRetryAttempts ?? 2

    if (this.data.intentNumber <= configuredAttempts) {
      this.data.scheduledAt = now
      this.data.startedAt = undefined
    } else {
      this.data.failedAt = now
      this.data.error = { time: now, message: 'Job stuck and exceeded maximum retries' }
    }
  }
}
