
import { IStorableData } from '@/core'
import { Job } from './Job'
import { singleton } from '@/injection'

export interface IJobEvent extends IStorableData {
  jobId: string
  type: 'created'
}

export type IJobEventListener = (event: IJobEvent) => void | Promise<void>

@singleton()
export class JobsEventsHub {
  private jobsEventsListener: IJobEventListener | null = null

  notifyJobCreated(job: Job) {
    if (!this.jobsEventsListener) {
      return
    }

    this.jobsEventsListener({
      jobId: job.id,
      commandName: job.commandName,
      type: 'created',
    })
  }

  listenJobsEvents(listener: IJobEventListener) {
    this.jobsEventsListener = listener
  }
}
