import { CrudRepository, query, repository } from '@'
import { EliaEvent } from './EliaEvent'

@repository({ table: 'elia_event', constructor: EliaEvent })
export class EliaEventRepository extends CrudRepository<EliaEvent> {
  @query() declare findByCategory: (category: string) => Promise<EliaEvent[]>
}
