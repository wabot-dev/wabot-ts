import { IStorableData } from '@/core/storable'
import { Job } from './Job'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'

export interface IJobEvent extends IStorableData {
  jobId: string
  type: 'created'
}

export type IJobEventListener = (event: IJobEvent) => void | Promise<void>

@singleton()
export class JobsEventsHub {
  private logger = new Logger('wabot:jobs-events-hub')
  private jobsEventsListener: IJobEventListener | null = null

  notifyJobCreated(job: Job) {
    const timer = setTimeout(async () => {
      if (!this.jobsEventsListener) {
        return
      }
      try {
        await this.jobsEventsListener({
          jobId: job.id,
          commandName: job.commandName,
          type: 'created',
        })
      } catch (err) {
        this.logger.error(err)
      } finally {
        clearTimeout(timer)
      }
    }, 1000)
  }

  listenJobsEvents(listener: IJobEventListener) {
    this.jobsEventsListener = listener
  }
}
