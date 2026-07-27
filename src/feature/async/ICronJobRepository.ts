import { CronJob } from './CronJob'

export interface ICronJobRepository {
  create(cronJob: CronJob): Promise<void>
  findDue(date?: Date): Promise<CronJob[]>
  findOrThrow(id: string): Promise<CronJob>
  update(cronJob: CronJob): Promise<void>
  /** `findOne` prefix: the method-name grammar is what generates this query. */
  findOneByName(name: string): Promise<CronJob | null>
}
