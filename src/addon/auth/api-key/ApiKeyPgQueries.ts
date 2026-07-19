import { dbExtension } from '@/feature/repository'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { ApiKey } from './ApiKey'
import { ApiKeyRepository } from './ApiKeyRepository'
import { IApiKeyQueries } from './IApiKeyQueries'

/**
 * Postgres implementation of {@link ApiKeyRepository}'s custom queries. Ships
 * with the framework and registers itself on import, so apps get it for free.
 * Uses JSONB containment (`@>`) so a GIN index on `data` can serve the lookup.
 */
@dbExtension(ApiKeyRepository)
export class ApiKeyPgQueries
  extends PgJsonbRepositoryExtension<ApiKey<any>>
  implements IApiKeyQueries<any>
{
  async findByMetadata(metadata: Record<string, string>): Promise<ApiKey<any>[]> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data @> $1::jsonb
    `
    return this.query(sql, [JSON.stringify({ metadata })])
  }
}
