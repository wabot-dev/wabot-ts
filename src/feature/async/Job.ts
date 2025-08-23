import { Entity, IEntityData } from "@/core/entity"
import { CustomError } from "@/core/error"


export interface IJobData extends IEntityData {
  commandName: string
  commandData: any
  startedAt?: number
  successAt?: number
  failedAt?: number
  error?: {
    message: string
    stack?: string
    info?: any
  }
}

export class Job extends Entity<IJobData> {
  get commandName() {
    return this.data.commandName
  }

  setAsStarted() {
    this.data.startedAt = new Date().getTime()
  }

  setAsSuccess() {
    this.data.successAt = new Date().getTime()
  }

  setAsFailed(error: Error) {
    this.data.failedAt = new Date().getTime()
    this.data.error = {
      message: error.message,
      stack: error.stack,
      info: error instanceof CustomError ? error.info : undefined,
    }
  }
}
