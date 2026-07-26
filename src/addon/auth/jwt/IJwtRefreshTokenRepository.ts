import { ICrudRepository } from '@/core/repository'
import { JwtRefreshToken } from './JwtRefreshToken'
import { IStorableType } from '@/core/storable/IStorableType'

export interface IJwtRefreshTokenValidateOptions {
  /** Only accept the token if it was created for this audience. */
  audience?: string
}

export interface IJwtRefreshTokenRepository<D extends object>
  extends ICrudRepository<JwtRefreshToken<D>> {
  findAndValidate(
    secret: string,
    options?: IJwtRefreshTokenValidateOptions,
  ): Promise<IStorableType<D>>
  findByMetadata(metadata: Record<string, string>): Promise<JwtRefreshToken<D>[]>
}
