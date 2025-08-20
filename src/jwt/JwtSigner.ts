import { JwtConfig } from './JwtConfig'
import jwt from 'jsonwebtoken'
import { JwtTokenDto } from './JwtTokenDto'

import { JwtRefreshToken } from './JwtRefreshToken'
import { JwtAccessAndRefreshTokenDto } from './JwtAccessAndRefreshTokenDto'
import { injectable } from '@/injection'
import { IStorableData } from '@/core'
import { Mapper } from '@/mapper'

@injectable()
export class JwtSigner {
  constructor(private config: JwtConfig, private mapper: Mapper) {}

  async signAccessToken<D extends IStorableData>(
    info: D | JwtRefreshToken<any>
  ): Promise<JwtTokenDto> {
    const _authInfo =
      info instanceof JwtRefreshToken
        ? {
            ...info.authInfo,
            refreshTokenId: info.id,
          }
        : info

    const token = jwt.sign(_authInfo, this.config.secretOrPrivateKey, {
      expiresIn: this.config.accessExpirationSeconds,
    })
    const expiration = new Date().getTime() + this.config.accessExpirationSeconds * 1000
    return this.mapper.map({ token, expiration }, JwtTokenDto)
  }

  async signRefreshToken(refreshToken: JwtRefreshToken<any>): Promise<JwtTokenDto> {
    const token = jwt.sign({ refreshTokenId: refreshToken.id }, this.config.secretOrPrivateKey, {
      expiresIn: this.config.refreshExpirationSeconds,
    })
    const expiration = new Date().getTime() + this.config.refreshExpirationSeconds * 1000
    return this.mapper.map({ token, expiration }, JwtTokenDto)
  }

  async signAccessAndRefreshToken(
    refreshToken: JwtRefreshToken<any>
  ): Promise<JwtAccessAndRefreshTokenDto> {
    const access = await this.signAccessToken(refreshToken)
    const refresh = await this.signRefreshToken(refreshToken)

    return this.mapper.map({ access, refresh }, JwtAccessAndRefreshTokenDto)
  }
}
