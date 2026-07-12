import { CrudRepository } from '@/core/repository'
import { CustomError } from '@/core/error'
import { IStorableType } from '@/core/storable/IStorableType'
import { query, queryExtension, repository } from '@/feature/repository'
import { IJwtRefreshTokenQueries } from './IJwtRefreshTokenQueries'
import { IJwtRefreshTokenRepository } from './IJwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'

/**
 * Refresh token store built on the standard repository pattern, so it works
 * with any registered adapter out of the box: in-memory by default, Postgres
 * when a `DATABASE_URL` is configured (the runner selects the adapter). Apps no
 * longer need to hand-write an in-memory implementation — just resolve this
 * class.
 *
 * CRUD comes from {@link CrudRepository}. `hashSecret` is deterministic, so a
 * token is looked up by its stored hash via an auto-generated field-equality
 * query, then validated (not expired, not revoked). `findByMetadata` needs
 * subset matching on the metadata object, so it delegates to a per-adapter
 * extension (both shipped by the framework — see the *MemoryQueries / *PgQueries).
 */
@repository({ table: 'jwt_refresh_token', constructor: JwtRefreshToken })
export class JwtRefreshTokenRepository<D extends object>
  extends CrudRepository<JwtRefreshToken<D>, IJwtRefreshTokenQueries<D>>
  implements IJwtRefreshTokenRepository<D>
{
  @query() declare findOneBySecretHash: (
    secretHash: string,
  ) => Promise<JwtRefreshToken<D> | null>

  @queryExtension() declare findByMetadata: (
    metadata: Record<string, string>,
  ) => Promise<JwtRefreshToken<D>[]>

  async findAndValidate(secret: string): Promise<IStorableType<D>> {
    const token = await this.findOneBySecretHash(JwtRefreshToken.hashSecret(secret))
    if (!token || !token.isValidToken(secret)) {
      throw new CustomError({ message: 'Invalid refresh token', httpCode: 401 })
    }
    return token.authInfo
  }
}
