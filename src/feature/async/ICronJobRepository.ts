import { CronJob } from './CronJob'

export interface ICronJobRepository {
  create(cronJob: CronJob): Promise<void>
  findDue(date?: Date): Promise<CronJob[]>
  findOrThrow(id: string): Promise<CronJob>
  update(cronJob: CronJob): Promise<void>
  findByName(name: string): Promise<CronJob | null>
}
