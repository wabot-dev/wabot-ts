import { IStorableType } from '@/core/storable/IStorableType'
import { ApiKey } from './ApiKey'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'

export class ApiKeyRepository<A extends object> implements IApiKeyRepository<A> {
  find(id: string): Promise<ApiKey<A> | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<ApiKey<A>> {
    throw new Error('Method not implemented.')
  }
  findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]> {
    throw new Error('Method not implemented.')
  }
  create(item: ApiKey<A>): Promise<void> {
    throw new Error('Method not implemented.')
  }
  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>> {
    throw new Error('Method not implemented.')
  }
  findBySecret(secret: string): Promise<ApiKey<A> | null> {
    throw new Error('Method not implemented.')
  }
  findAndValidate(secret: string): Promise<IStorableType<A>> {
    throw new Error('Method not implemented.')
  }
}
