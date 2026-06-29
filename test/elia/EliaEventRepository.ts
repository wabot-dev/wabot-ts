import { CrudRepository, query, queryExtension, repository } from '@'
import { EliaEvent } from './EliaEvent'
import { IEliaEventPgQueries } from './IEliaEventPgQueries'

@repository({ table: 'elia_event', constructor: EliaEvent })
export class EliaEventRepository
  extends CrudRepository<EliaEvent, IEliaEventPgQueries>
  implements IEliaEventPgQueries
{
  @query() declare findByCategory: (category: string) => Promise<EliaEvent[]>

  @queryExtension() declare findUpcoming: (
    fromMillis: number,
    limit: number,
  ) => Promise<EliaEvent[]>

  @queryExtension() declare findByUserInRange: (
    userId: string,
    fromMillis: number,
    toMillis: number,
  ) => Promise<EliaEvent[]>
}
