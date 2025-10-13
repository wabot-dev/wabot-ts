import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'

export class ApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  findAuthInfoBySecret(secret: string): Promise<A> {
    throw new Error('Method not implemented.')
  }

  findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]> {
    throw new Error('Method not implemented.')
  }

  find(id: string): Promise<ApiKey<A> | null> {
    throw new Error('Method not implemented.')
  }

  findOrThrow(id: string): Promise<ApiKey<A>> {
    throw new Error('Method not implemented.')
  }

  create(item: ApiKey<A>): Promise<void> {
    throw new Error('Method not implemented.')
  }

  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>> {
    throw new Error('Method not implemented.')
  }
}
