import { singleton } from '@/core/injection'

import { Pool } from 'pg'
import { IStorableData } from '@/core/storable'
import { PgCrudRepository } from '@/feature/pg'
import { JwtRefreshToken } from './JwtRefreshToken'
import { IJwtRefreshTokenRepository } from './IJwtRefreshTokenRepository'

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
}
