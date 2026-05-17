import { memExtension, MemoryRepositoryExtension } from '@'
import { EliaEvent } from './EliaEvent'
import { EliaEventRepository } from './EliaEventRepository'
import { IEliaEventPgQueries } from './IEliaEventPgQueries'

@memExtension(EliaEventRepository)
export class EliaEventMemoryQueries
  extends MemoryRepositoryExtension<EliaEvent>
  implements IEliaEventPgQueries
{
  async findUpcoming(fromMillis: number, limit: number): Promise<EliaEvent[]> {
    return [...this.items.values()]
      .filter((e) => e['data'].dateTime >= fromMillis)
      .sort((a, b) => a['data'].dateTime - b['data'].dateTime)
      .slice(0, limit)
      .map((e) => this.clone(e))
  }

  async findByUserInRange(
    userId: string,
    fromMillis: number,
    toMillis: number,
  ): Promise<EliaEvent[]> {
    return [...this.items.values()]
      .filter(
        (e) =>
          e['data'].userId === userId &&
          e['data'].dateTime >= fromMillis &&
          e['data'].dateTime <= toMillis,
      )
      .sort((a, b) => a['data'].dateTime - b['data'].dateTime)
      .map((e) => this.clone(e))
  }
}
