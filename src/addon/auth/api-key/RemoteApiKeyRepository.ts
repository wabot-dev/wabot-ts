import { IStorableData } from '@/core/storable'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { CustomError } from '@/core/error'

export interface IRemoteApiKeyFetcher<A extends IStorableData> {
  fetchAuthInfoBySecret: (secret: string) => Promise<A | null>
}

export class RemoteApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  private cacheBySecret = new Map<string, { value: A | null; expiresAt: number }>()

  constructor(
    private fetcher: IRemoteApiKeyFetcher<A>,
    private cacheSeconds: number,
  ) {}

  async findAndValidate(secret: string): Promise<A> {
    const now = Date.now()

    const cached = this.cacheBySecret.get(secret)
    if (cached && cached.expiresAt > now) {
      if (!cached.value) {
        throw new CustomError({ message: 'Invalid Api Key', httpCode: 401 })
      }
      return cached.value
    }

    const result = await this.fetcher.fetchAuthInfoBySecret(secret)

    this.cacheBySecret.set(secret, {
      value: result,
      expiresAt: now + this.cacheSeconds * 1000,
    })

    if (!result) {
      throw new CustomError({ message: 'Invalid Api Key', httpCode: 401 })
    }

    return result
  }

  find(id: string): Promise<ApiKey<A> | null> {
    throw new Error('Method not implemented.')
  }

  findOrThrow(id: string): Promise<ApiKey<A>> {
    throw new Error('Method not implemented.')
  }

  findBySecret(secret: string): Promise<ApiKey<A> | null> {
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
}
