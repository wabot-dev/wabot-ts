import { IStorableData } from '@/core/storable'
import { PgCrudRepository } from '@/feature/pg'
import { Pool } from 'pg'
import { ApiKey } from './ApiKey'
import { IApiKeyRepository, IGenerateApiKeyReq, IGenerateApiKeyRes } from './IApiKeyRepository'
import { CustomError } from '@/core/error'
import { singleton } from '@/core/injection'

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

  async findAndValidate(secret: string): Promise<A> {
    const apiKey = await this.findBySecret(secret)
    if (!apiKey) {
      throw new CustomError({ message: 'Invalid Api Key', httpCode: 401 })
    }
    return apiKey.authInfo
  }

  async findBySecret(secret: string): Promise<ApiKey<A> | null> {
    const secretHash = ApiKey.hashSecret(secret)
    const query = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data @> $1::jsonb
      LIMIT 1
    `
    const items = await this.query(query, [JSON.stringify({ secretHash })])
    return items[0] ?? null
  }

  async findByMetadata(metadata: Record<string, string>): Promise<ApiKey<A>[]> {
    const query = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data @> $1::jsonb
    `
    return await this.query(query, [JSON.stringify({ metadata })])
  }

  async generate(req: IGenerateApiKeyReq<A>): Promise<IGenerateApiKeyRes<A>> {
    const apiKey = new ApiKey({
      name: req.name,
      metadata: req.metadata,
      authInfo: req.authInfo,
    })

    const secret = apiKey.generateSecret()
    await this.create(apiKey)

    return {
      apiKey,
      secret,
    }
  }
}
