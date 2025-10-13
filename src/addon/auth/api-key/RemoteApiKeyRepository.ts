import { IStorableData } from '@/core/storable'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { CustomError } from '@/core/error'

export interface IRemoteApiKeyFetcher<A extends IStorableData> {
  fetchById: (id: string) => Promise<ApiKey<A> | null>
  fetchBySecret: (secret: string) => Promise<ApiKey<A> | null>
}

export class RemoteApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  private cacheById = new Map<string, { value: ApiKey<A> | null; expiresAt: number }>()
  private cacheBySecret = new Map<string, { value: ApiKey<A> | null; expiresAt: number }>()

  constructor(
    private fetcher: IRemoteApiKeyFetcher<A>,
    private cacheSeconds: number,
  ) {}

  async find(id: string): Promise<ApiKey<A> | null> {
    const now = Date.now()

    const cached = this.cacheById.get(id)
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const result = await this.fetcher.fetchById(id)

    this.cacheById.set(id, {
      value: result,
      expiresAt: now + this.cacheSeconds * 1000,
    })

    return result
  }

  async findOrThrow(id: string): Promise<ApiKey<A>> {
    const result = await this.find(id)
    if (!result) {
      throw new Error(`API key with ID '${id}' not found.`)
    }
    return result
  }

  async findAuthInfoBySecret(secret: string): Promise<A> {
    const now = Date.now()

    const cached = this.cacheBySecret.get(secret)
    if (cached && cached.expiresAt > now) {
      if (!cached.value) {
        throw new CustomError({ message: 'Invalid Api Key', httpCode: 401 })
      }
      return cached.value.authInfo
    }

    const result = await this.fetcher.fetchBySecret(secret)

    this.cacheBySecret.set(secret, {
      value: result,
      expiresAt: now + this.cacheSeconds * 1000,
    })

    if (!result) {
      throw new CustomError({ message: 'Invalid Api Key', httpCode: 401 })
    }

    return result.authInfo
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
