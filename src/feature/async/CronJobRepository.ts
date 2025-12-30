import { CronJob } from './CronJob'
import { ICronJobRepository } from './ICronJobRepository'

export class CronJobRepository implements ICronJobRepository {
  update(cronJob: CronJob): Promise<void> {
    throw new Error('Method not implemented.')
  }
  findDue(date?: Date): Promise<CronJob[]> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<CronJob> {
    throw new Error('Method not implemented.')
  }
}
