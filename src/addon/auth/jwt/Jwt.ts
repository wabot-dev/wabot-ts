import { JwtAccessAndRefreshTokenDto } from './JwtAccessAndRefreshTokenDto'

import { JwtSigner } from './JwtSigner'
import { JwtRefreshTokenRepository } from './JwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'
import { injectable } from '@/core/injection'
import { Auth } from '@/core/auth'
import { JwtConfig } from './JwtConfig'
import { JwtTokenDto } from './JwtTokenDto'

export interface IJwtSessionOptions {
  /**
   * Audience the session belongs to (`aud` claim). Guards declaring the same
   * audience accept the access token; guards declaring another one reject it,
   * even though every session is signed with the same secret. The refresh
   * token remembers it, so `findRefreshTokenAuthInfo` can refuse to renew a
   * session of one kind through the endpoint of another.
   */
  audience?: string
}

@injectable()
export class Jwt {
  constructor(
    private auth: Auth<any>,
    private jwtSigner: JwtSigner,
    private jwtRefreshTokenRepository: JwtRefreshTokenRepository<any>,
    private config: JwtConfig,
  ) {}

  async createToken(
    metadata?: Record<string, string>,
    options: IJwtSessionOptions = {},
  ): Promise<JwtAccessAndRefreshTokenDto> {
    const authInfo = this.auth.require()
    const refreshToken = new JwtRefreshToken({
      metadata,
      authInfo,
      audience: options.audience,
      expirationTime: Date.now() + this.config.refreshExpirationSeconds * 1000,
    })
    const refreshSecret = refreshToken.generateSecret()
    await this.jwtRefreshTokenRepository.create(refreshToken)

    const access = await this.jwtSigner.signAccessToken(refreshToken)
    const refresh: JwtTokenDto = {
      token: refreshSecret,
      expiration: new Date(refreshToken.expirationTime),
    }
    return {
      access,
      refresh,
    }
  }

  /**
   * Validate a refresh token secret and return its authInfo. Pass the same
   * `audience` the session was created with so a refresh endpoint only renews
   * sessions of its own kind.
   */
  async findRefreshTokenAuthInfo(secret: string, options: IJwtSessionOptions = {}) {
    return await this.jwtRefreshTokenRepository.findAndValidate(secret, options)
  }
}
