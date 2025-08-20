
import { singleton } from '@/injection'
import { JwtRefreshToken } from './JwtRefreshToken'
import { Pool } from 'pg'
import { IStorableData } from '@/core'
import { PgCrudRepository } from '@/repository'

@singleton()
export class JwtRefreshTokenRepository<D extends IStorableData> extends PgCrudRepository<
  JwtRefreshToken<D>
> {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'wabot',
      table: 'jwt_refresh_token',
      constructor: JwtRefreshToken,
    })
  }
}
