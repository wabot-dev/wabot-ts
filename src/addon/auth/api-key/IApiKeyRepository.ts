import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'

export interface IApiKeyRepository<A extends IStorableData> {
  find(id: string): Promise<ApiKey<A> | null>
  findOrThrow(id: string): Promise<ApiKey<A>>
  findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]>
  create(item: ApiKey<A>): Promise<void>
  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>>
  findAuthInfoBySecret(secret: string): Promise<A | null>
}

export interface IGenerateApiKeyReq<A extends IStorableData> extends IStorableData {
  name: string
  metadata?: Record<string, string>
  authInfo: A
}

export interface IGenerateApiKeyRes<A extends IStorableData> {
  apiKey: ApiKey<A>
  secret: string
}
