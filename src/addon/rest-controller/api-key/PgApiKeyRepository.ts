import { PgCrudRepository } from '@/addon/repository'
import { IApiKeyRepository } from './IApiKeyRepository'
import { ApiKey } from './ApiKey'
import { Pool } from 'pg'

export class PgApiKeyRepository extends PgCrudRepository<ApiKey> implements IApiKeyRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'apy_key',
      constructor: ApiKey,
    })
  }
}
