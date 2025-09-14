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

  async createToken(): Promise<JwtAccessAndRefreshTokenDto> {
    const authInfo = this.auth.require()
    const refreshToken = new JwtRefreshToken({
      authInfo,
      expirationTime: new Date().getTime() + this.config.refreshExpirationSeconds * 1000,
    })
    const refreshPassword = refreshToken.generatePassword()
    await this.jwtRefreshTokenRepository.create(refreshToken)

    const access = await this.jwtSigner.signAccessToken(refreshToken)
    const refresh: JwtTokenDto = {
      token: JwtRefreshToken.deflate({ id: refreshToken.id, pass: refreshPassword }),
      expiration: new Date(refreshToken.expirationTime),
    }
    return {
      access,
      refresh,
    }
  }

  async refreshToken(refreshSecret: string): Promise<JwtTokenDto> {
    const { id, pass } = JwtRefreshToken.inflate(refreshSecret)
    const refreshToken = await this.jwtRefreshTokenRepository.findOrThrow(id)
    refreshToken.validatePassword(pass)
    return this.jwtSigner.signAccessToken(refreshToken)
  }
}
