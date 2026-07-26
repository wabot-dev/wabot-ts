import jwt from 'jsonwebtoken'
import { JwtConfig } from './JwtConfig'
import { JwtTokenDto } from './JwtTokenDto'

import { injectable } from '@/core/injection'
import { Mapper } from '@/core/mapper'
import { JwtRefreshToken } from './JwtRefreshToken'
import { IStorableType } from '@/core/storable/IStorableType'

export interface IJwtSignAccessTokenOptions {
  /**
   * `aud` claim to stamp on the token, so guards declaring the same audience
   * accept it and guards declaring another one reject it. When signing from a
   * refresh token it defaults to the audience that token was created with.
   */
  audience?: string
}

@injectable()
export class JwtSigner {
  constructor(
    private config: JwtConfig,
    private mapper: Mapper,
  ) {}

  async signAccessToken<D extends object>(
    info: IStorableType<D> | JwtRefreshToken<any>,
    options: IJwtSignAccessTokenOptions = {},
  ): Promise<JwtTokenDto> {
    const _authInfo =
      info instanceof JwtRefreshToken
        ? {
            ...info.authInfo,
            refreshTokenId: info.id,
          }
        : info

    const audience =
      options.audience ?? (info instanceof JwtRefreshToken ? info.audience : undefined)

    const token = jwt.sign(_authInfo, this.config.secretOrPrivateKey, {
      expiresIn: this.config.accessExpirationSeconds,
      ...(audience ? { audience } : {}),
    })
    const expiration = new Date(new Date().getTime() + this.config.accessExpirationSeconds * 1000)
    return this.mapper.map({ token, expiration }, JwtTokenDto)
  }
}
