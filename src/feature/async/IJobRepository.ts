import { ICrudRepository } from '@/core/repository'
import { Job } from './Job'

export interface IJobRepository extends ICrudRepository<Job> {
  findPendingForRunFrom(date: Date, limit: number): Promise<Job[]>
  findRunningJobs(): Promise<Job[]>
  countRunningByCommand(commandName: string): Promise<number>
}
