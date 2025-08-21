
import { Pool } from 'pg'
import { Job } from './Job'
import { singleton } from '@/injection'
import { PgCrudRepository } from '@/repository'

@singleton()
export class JobRepository extends PgCrudRepository<Job> {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'job',
      constructor: Job,
    })
  }
}
