import { injectable, PgCrudRepository } from '@'
import { EliaEvent } from '../models/EliaEvent'

@injectable()
export class EliaEventRepository extends PgCrudRepository<EliaEvent> {
  save(item: EliaEvent): Promise<EliaEvent> {
    return new Promise((resolve) => {
      resolve(item)
    })
  }
}
