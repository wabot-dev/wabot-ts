import { ICrudRepository } from '@/core/repository'
import { Job } from './Job'

export interface IJobRepository extends ICrudRepository<Job> {
  findScheduledBefore(date?: Date): Promise<Job[]>
  findRunningJobs(): Promise<Job[]>
}
