import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { Pool } from 'pg'
import { PgCrudRepository } from '@/feature/pg'
import { singleton } from 'tsyringe'
import { IStorableData } from '@/core/storable'
import { ApiKeyRepository } from './ApiKeyRepository'

@singleton()
export class PgApiKeyRepository<A extends IStorableData>
  extends PgCrudRepository<ApiKey<A>>
  implements IApiKeyRepository<A>
{
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'api_key',
      constructor: ApiKey,
    })
  }

  findAuthInfo(secret: string): Promise<A> {
    return ApiKeyRepository.findAuthInfo(this, secret)
  }

  async generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes> {
    return ApiKeyRepository.generate(this, req)
  }
}
