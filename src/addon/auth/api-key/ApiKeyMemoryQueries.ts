import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'
import { ApiKey } from './ApiKey'
import { ApiKeyRepository } from './ApiKeyRepository'
import { IApiKeyQueries } from './IApiKeyQueries'

/**
 * In-memory implementation of {@link ApiKeyRepository}'s custom queries. Ships
 * with the framework and registers itself on import, so apps get it for free.
 */
@memExtension(ApiKeyRepository)
export class ApiKeyMemoryQueries
  extends MemoryRepositoryExtension<ApiKey<any>>
  implements IApiKeyQueries<any>
{
  async findByMetadata(metadata: Record<string, string>): Promise<ApiKey<any>[]> {
    return [...this.items.values()]
      .map((key) => this.clone(key))
      .filter((key) => Object.entries(metadata).every(([k, v]) => key.metadata[k] === v))
  }
}
