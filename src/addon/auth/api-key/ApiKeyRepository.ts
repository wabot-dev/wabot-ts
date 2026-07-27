import { CrudRepository } from '@/core/repository'
import { CustomError } from '@/core/error'
import { IStorableType } from '@/core/storable/IStorableType'
import { query, queryExtension, repository } from '@/feature/repository'
import { ApiKey } from './ApiKey'
import { IApiKeyQueries } from './IApiKeyQueries'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'

/**
 * API key store built on the standard repository pattern, so it works with any
 * registered adapter out of the box: in-memory by default, Postgres when a
 * `DATABASE_URL` is configured (the runner selects the adapter). Apps no longer
 * need to hand-write an in-memory implementation — just resolve this class.
 *
 * `find`/`findOrThrow`/`create` come from {@link CrudRepository}. `hashSecret`
 * is deterministic, so a key is looked up by its stored hash via an
 * auto-generated field-equality query. `findByMetadata` needs subset matching
 * on the metadata object, so it delegates to a per-adapter extension (both
 * shipped by the framework — see ApiKeyMemoryQueries / ApiKeyPgQueries).
 */
@repository({ schema: 'wabot', table: 'api_key', constructor: ApiKey })
export class ApiKeyRepository<A extends object>
  extends CrudRepository<ApiKey<A>, IApiKeyQueries<A>>
  implements IApiKeyRepository<A>
{
  @query() declare findOneBySecretHash: (secretHash: string) => Promise<ApiKey<A> | null>

  @queryExtension() declare findByMetadata: (
    metadata: Record<string, string>,
  ) => Promise<ApiKey<A>[]>

  async findBySecret(secret: string): Promise<ApiKey<A> | null> {
    return this.findOneBySecretHash(ApiKey.hashSecret(secret))
  }

  async findAndValidate(secret: string): Promise<IStorableType<A>> {
    const apiKey = await this.findBySecret(secret)
    if (!apiKey || !apiKey.isValidSecret(secret)) {
      throw new CustomError({ message: 'Invalid API key', httpCode: 401 })
    }
    return apiKey.authInfo
  }

  async generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>> {
    const apiKey = new ApiKey<A>({
      name: req.name,
      metadata: req.metadata,
      authInfo: req.authInfo,
    })
    const secret = apiKey.generateSecret()
    await this.create(apiKey)
    return { apiKey, secret }
  }
}
