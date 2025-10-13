import { singleton } from '@/core/injection'

import { Pool } from 'pg'
import { IStorableData } from '@/core/storable'
import { PgCrudRepository } from '@/feature/pg'
import { JwtRefreshToken } from './JwtRefreshToken'
import { IJwtRefreshTokenRepository } from './IJwtRefreshTokenRepository'
import { CustomError } from '@/core/error'

@singleton()
export class PgJwtRefreshTokenRepository<D extends IStorableData>
  extends PgCrudRepository<JwtRefreshToken<D>>
  implements IJwtRefreshTokenRepository<D>
{
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'jwt_refresh_token',
      constructor: JwtRefreshToken,
    })
  }

  async findAndValidate(secret: string): Promise<D> {
    const apiKey = await this.findBySecret(secret)
    if (!apiKey) {
      throw new CustomError({ message: 'Invalid Token', httpCode: 401 })
    }
    return apiKey.authInfo
  }

  async findBySecret(secret: string): Promise<JwtRefreshToken<D> | null> {
    const secretHash = JwtRefreshToken.hashSecret(secret)
    const query = `
        SELECT ${this.columns}
        FROM ${this.table}
        WHERE data @> $1::jsonb
        LIMIT 1
      `
    const items = await this.query(query, [JSON.stringify({ secretHash })])
    return items[0] ?? null
  }

  async findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]> {
    const query = `
        SELECT ${this.columns}
        FROM ${this.table}
        WHERE data @> $1::jsonb
      `
    return await this.query(query, [JSON.stringify({ metadata })])
  }
}
