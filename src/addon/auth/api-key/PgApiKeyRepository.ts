import { IApiKeyRepository } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { Pool } from 'pg'
import { PgCrudRepository } from '@/feature/pg'
import { singleton } from 'tsyringe'

@singleton()
export class PgApiKeyRepository extends PgCrudRepository<ApiKey> implements IApiKeyRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'api_key',
      constructor: ApiKey,
    })
  }
}
