import { Pool } from 'pg'

import { singleton } from '@/core/injection'
import { PgCrudRepository } from '@/feature/pg'
import { IJobRepository, Job } from '@/feature/async'

@singleton()
export class PgJobRepository extends PgCrudRepository<Job> implements IJobRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'job',
      constructor: Job,
    })
  }
}
