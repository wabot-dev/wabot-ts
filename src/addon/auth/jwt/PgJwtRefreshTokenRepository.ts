import { singleton } from '@/core/injection'

import { CustomError } from '@/core/error'
import { IStorableType } from '@/core/storable/IStorableType'
import { PgCrudRepository } from '@/feature/pg'
import { Pool } from 'pg'
import { IJwtRefreshTokenRepository } from './IJwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'

@singleton()
export class PgJwtRefreshTokenRepository<D extends object>
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

  async findAndValidate(secret: string): Promise<IStorableType<D>> {
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
