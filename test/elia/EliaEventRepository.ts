import { CrudRepository, query, repository } from '@'
import { EliaEvent } from './EliaEvent'
import { IEliaEventPgQueries } from './IEliaEventPgQueries'

@repository({ table: 'elia_event', constructor: EliaEvent })
export class EliaEventRepository
  extends CrudRepository<EliaEvent, IEliaEventPgQueries>
  implements IEliaEventPgQueries
{
  @query() declare findByCategory: (category: string) => Promise<EliaEvent[]>

  findUpcoming(fromMillis: number, limit: number): Promise<EliaEvent[]> {
    return this.extension.findUpcoming(fromMillis, limit)
  }

  findByUserInRange(
    userId: string,
    fromMillis: number,
    toMillis: number,
  ): Promise<EliaEvent[]> {
    return this.extension.findByUserInRange(userId, fromMillis, toMillis)
  }
}
