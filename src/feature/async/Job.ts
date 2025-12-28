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

  isScheduleReady() {
    return this.data.scheduledAt != null && this.data.scheduledAt <= new Date().getTime()
  }

  hasStarted() {
    return this.data.startedAt != null && !this.hasFinished()
  }

  isRunning() {
    return this.data.startedAt != null && this.data.successAt == null && this.data.failedAt == null
  }

  isStuck() {
    return this.runningSeconds > (this.data.aceptableRunningTimeSeconds ?? 900)
  }

  hasFinished() {
    return (
      this.data.successAt != null || (this.data.failedAt != null && this.data.scheduledAt == null)
    )
  }

  setAsStarted() {
    const now = new Date().getTime()
    if (!this.data.scheduledAt) throw new Error(`job ${this.id} can't be started without schedule`)
    if (this.data.scheduledAt < now)
      throw new Error(`job ${this.id} can't be started before schedule`)

    this.data.startedAt = now
    this.data.successAt = undefined
    this.data.failedAt = undefined
    this.data.intentNumber = this.data.intentNumber == null ? 0 : this.data.intentNumber + 1
  }

  setAsSuccess() {
    const now = new Date().getTime()

    this.data.successAt = now
    this.data.failedAt = undefined
    this.data.scheduledAt = undefined
  }

  setAsFailed(error: Error) {
    const now = new Date().getTime()
    this.data.failedAt = now
    this.data.error = {
      message: error.message,
      stack: error.stack,
      info: error instanceof CustomError ? error.info : undefined,
    }

    this.data.scheduledAt = undefined

    if (this.data.intentNumber == null) return
    if (!this.data.reintentsDelaysInSeconds) return

    const currentReintentDelay = this.data.reintentsDelaysInSeconds[this.data.intentNumber]
    this.data.scheduledAt = now + currentReintentDelay * 1000
  }

  recover() {
    const now = Date.now()

    if (!this.isRunning()) return
    if (!this.isStuck()) return

    this.data.startedAt = undefined
    this.data.successAt = undefined
    this.data.failedAt = undefined
    this.data.error = undefined

    this.data.intentNumber = (this.data.intentNumber ?? 0) + 1

    const configuredAttempts = this.data.stuckRetryAttempts ?? 2

    if (this.data.intentNumber <= configuredAttempts) {
      this.data.scheduledAt = now
    } else {
      this.data.failedAt = now
      this.data.error = { message: 'Job stuck and exceeded maximum retries' }
    }
  }
}
