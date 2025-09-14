import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'

export interface IApiKeyRepository<A extends IStorableData> {
  find(id: string): Promise<ApiKey<A> | null>
  findOrThrow(id: string): Promise<ApiKey<A>>
  create(item: ApiKey<A>): Promise<void>
}
