import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'

export interface IJobData extends IEntityData {
  commandName: string
  commandData: any
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
}

export class Job extends Entity<IJobData> {
  get commandName() {
    return this.data.commandName
  }

  get runningSeconds() {
    if (!this.isRunning()) return -1

    const now = new Date().getTime()
    return (now - this.data.startedAt!) / 1000
  }

  get successAt() {
    return this.data.successAt != null ? new Date(this.data.successAt) : null
  }

  get failedAt() {
    return this.data.failedAt != null ? new Date(this.data.failedAt) : null
  }

  get scheduledAt() {
    return this.data.scheduledAt != null ? new Date(this.data.scheduledAt) : null
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
    return this.runningSeconds > (this.data.aceptableRunningTimeSeconds ?? 900)
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
    if (!this.isRunning())
      throw new Error(`job ${this.id} can't be set as failed because is no running`)

    const now = new Date().getTime()

    this.data.error = {
      time: now,
      message: error.message,
      stack: error.stack,
      info: error instanceof CustomError ? error.info : undefined,
    }

    if (this.data.intentNumber == null) throw new Error('Invalid intent number')
    const currentReintentDelay = (this.data.reintentsDelaysInSeconds ?? []).at(
      this.data.intentNumber,
    )

    if (currentReintentDelay == null) {
      this.data.failedAt = now
    } else {
      this.data.scheduledAt = now + currentReintentDelay * 1000
    }
  }

  recover() {
    if (!this.isStuck()) throw new Error(`job ${this.id} Can't be recovered because is not stuck`)

    const now = Date.now()

    this.data.intentNumber = (this.data.intentNumber ?? 0) + 1

    const configuredAttempts = this.data.stuckRetryAttempts ?? 2

    if (this.data.intentNumber <= configuredAttempts) {
      this.data.scheduledAt = now
    } else {
      this.data.failedAt = now
      this.data.error = { time: now, message: 'Job stuck and exceeded maximum retries' }
    }
  }
}
