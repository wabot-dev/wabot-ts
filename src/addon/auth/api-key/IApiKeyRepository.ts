import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'

export interface IApiKeyRepository<A extends IStorableData> {
  find(id: string): Promise<ApiKey<A> | null>
  findOrThrow(id: string): Promise<ApiKey<A>>
  create(item: ApiKey<A>): Promise<void>
  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes>
  findAuthInfo(secret: string): Promise<A>
}

export interface IGenerateApiKeyReq<A extends IStorableData> extends IStorableData {
  name: string
  authInfo: A
}

export interface IGenerateApiKeyRes {
  id: string
  secret: string
}
