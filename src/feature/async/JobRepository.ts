import { Job } from './Job'
import { singleton } from '@/core/injection'
import { IJobRepository } from './IJobRepository'

@singleton()
export class JobRepository implements IJobRepository {
  findRunningJobs(): Promise<Job[]> {
    throw new Error('Method not implemented.')
  }
  findScheduledBefore(date?: Date): Promise<Job[]> {
    throw new Error('Method not implemented.')
  }
  find(id: string): Promise<Job | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<Job> {
    throw new Error('Method not implemented.')
  }
  findByIds(ids: string[]): Promise<Job[]> {
    throw new Error('Method not implemented.')
  }
  findAll(id: string): Promise<Job[]> {
    throw new Error('Method not implemented.')
  }
  create(item: Job): Promise<void> {
    throw new Error('Method not implemented.')
  }
  update(item: Job): Promise<void> {
    throw new Error('Method not implemented.')
  }
  delete(item: Job): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
