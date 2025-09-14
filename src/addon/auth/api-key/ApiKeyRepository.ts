import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'
import { IApiKeyRepository } from './IApiKeyRepository'

export class ApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  find(id: string): Promise<ApiKey<A> | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<ApiKey<A>> {
    throw new Error('Method not implemented.')
  }

  create(item: ApiKey<A>): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
