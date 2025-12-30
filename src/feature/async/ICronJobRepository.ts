import { CronJob } from './CronJob'

export interface ICronJobRepository {
  findDue(date?: Date): Promise<CronJob[]>
  findOrThrow(id: string): Promise<CronJob>
  update(cronJob: CronJob): Promise<void>
}
