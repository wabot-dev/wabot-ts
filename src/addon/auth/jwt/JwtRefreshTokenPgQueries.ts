import { dbExtension } from '@/feature/repository'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { IJwtRefreshTokenQueries } from './IJwtRefreshTokenQueries'
import { JwtRefreshToken } from './JwtRefreshToken'
import { JwtRefreshTokenRepository } from './JwtRefreshTokenRepository'

/**
 * Postgres implementation of {@link JwtRefreshTokenRepository}'s custom
 * queries. Ships with the framework and registers itself on import. Uses JSONB
 * containment (`@>`) so a GIN index on `data` can serve the lookup.
 */
@dbExtension(JwtRefreshTokenRepository)
export class JwtRefreshTokenPgQueries
  extends PgJsonbRepositoryExtension<JwtRefreshToken<any>>
  implements IJwtRefreshTokenQueries<any>
{
  async findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<any>[]> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data @> $1::jsonb
    `
    return this.query(sql, [JSON.stringify({ metadata })])
  }
}
