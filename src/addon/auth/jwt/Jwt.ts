import { JwtAccessAndRefreshTokenDto } from './JwtAccessAndRefreshTokenDto'

import { JwtSigner } from './JwtSigner'
import { JwtRefreshTokenRepository } from './JwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'
import { injectable } from '@/core/injection'
import { Auth } from '@/core/auth'
import { JwtConfig } from './JwtConfig'
import { JwtTokenDto } from './JwtTokenDto'

@injectable()
export class Jwt {
  constructor(
    private auth: Auth<any>,
    private jwtSigner: JwtSigner,
    private jwtRefreshTokenRepository: JwtRefreshTokenRepository<any>,
    private config: JwtConfig,
  ) {}

  async createToken(metadata?: Record<string, string>): Promise<JwtAccessAndRefreshTokenDto> {
    const authInfo = this.auth.require()
    const refreshToken = new JwtRefreshToken({
      metadata,
      authInfo,
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

  async findRefreshTokenAuthInfo(secret: string) {
    return await this.jwtRefreshTokenRepository.findAndValidate(secret)
  }
}
