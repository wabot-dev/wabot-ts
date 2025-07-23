import { injectable, PgCrudRepository } from '@'
import { EliaEvent } from '../models/EliaEvent'
import { Pool } from 'pg'

@injectable()
export class EliaEventRepository extends PgCrudRepository<EliaEvent> {
  constructor(pool: Pool) {
    super(pool, {
      table: 'event',
      schema: 'elia',
      constructor: EliaEvent,
    })
  }

  save(item: EliaEvent): Promise<EliaEvent> {
    return new Promise((resolve) => {
      resolve(item)
    })
  }
}
