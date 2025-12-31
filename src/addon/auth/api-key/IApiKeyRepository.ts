import { IStorableType } from '@/core/storable/IStorableType'
import { ApiKey } from './ApiKey'

export interface IApiKeyRepository<A extends object> {
  find(id: string): Promise<ApiKey<A> | null>
  findOrThrow(id: string): Promise<ApiKey<A>>
  findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]>
  create(item: ApiKey<A>): Promise<void>
  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>>
  findBySecret(secret: string): Promise<ApiKey<A> | null>
  findAndValidate(secret: string): Promise<IStorableType<A>>
}

export interface IGenerateApiKeyReq<A extends object> {
  name: string
  metadata?: Record<string, string>
  authInfo: IStorableType<A>
}

export interface IGenerateApiKeyRes<A extends object> {
  apiKey: ApiKey<A>
  secret: string
}
