import { singleton } from '@/core/injection'
import { JwtRefreshToken } from './JwtRefreshToken'
import { Pool } from 'pg'
import { IStorableData } from '@/core/storable'
import { PgCrudRepository } from '@/addon/repository/pg'

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
