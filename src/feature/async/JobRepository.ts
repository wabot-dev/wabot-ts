import { Job } from './Job'
import { singleton } from '@/core/injection'
import { IJobRepository } from './IJobRepository'

@singleton()
export class JobRepository implements IJobRepository {
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
  discard(item: Job): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
