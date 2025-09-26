import { IStorableData } from '@/core/storable'
import { ApiKey } from './ApiKey'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'

export class ApiKeyRepository<A extends IStorableData> implements IApiKeyRepository<A> {
  findAuthInfo(secret: string): Promise<A> {
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

  generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes> {
    throw new Error('Method not implemented.')
  }

  static async generate(repository: ApiKeyRepository<any>, req: IGenerateApiKeyReq<any>) {
    const apiKey = new ApiKey(req)
    const pass = apiKey.generatePassword()
    await repository.create(apiKey)
    const id = apiKey.id
    const secret = ApiKey.deflate({ id, pass })
    return { id, secret }
  }

  static async findAuthInfo<A extends IStorableData>(
    repository: ApiKeyRepository<A>,
    secret: string,
  ): Promise<A> {
    const { id, pass } = ApiKey.inflate(secret)
    const apiKey = await repository.findOrThrow(id)
    apiKey.validatePassword(pass)
    return apiKey.authInfo
  }
}
