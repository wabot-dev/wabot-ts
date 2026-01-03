import { CronJob } from './CronJob'
import { ICronJobRepository } from './ICronJobRepository'

export class CronJobRepository implements ICronJobRepository {
  create(cronJob: CronJob): Promise<void> {
    throw new Error('Method not implemented.')
  }
  findByName(name: string): Promise<CronJob | null> {
    throw new Error('Method not implemented.')
  }
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
