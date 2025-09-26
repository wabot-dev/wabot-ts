import { IStorableData } from '@/core/storable'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { ApiKeyRepository } from './ApiKeyRepository'

export class RemoteApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  private cache = new Map<string, { value: ApiKey<A> | null; expiresAt: number }>()

  constructor(
    private fetcher: (id: string) => Promise<ApiKey<A> | null>,
    private cacheSeconds: number,
  ) {}

  async find(id: string): Promise<ApiKey<A> | null> {
    const now = Date.now()

    const cached = this.cache.get(id)
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const result = await this.fetcher(id)

    this.cache.set(id, {
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

  findAuthInfo(secret: string): Promise<A> {
    return ApiKeyRepository.findAuthInfo(this, secret)
  }

  create(item: ApiKey<A>): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes> {
    throw new Error('Method not implemented.')
  }
}
