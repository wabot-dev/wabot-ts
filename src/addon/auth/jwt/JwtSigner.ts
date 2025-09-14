import jwt from 'jsonwebtoken'
import { JwtConfig } from './JwtConfig'
import { JwtTokenDto } from './JwtTokenDto'

import { injectable } from '@/core/injection'
import { Mapper } from '@/core/mapper'
import { IStorableData } from '@/core/storable'
import { JwtRefreshToken } from './JwtRefreshToken'

@injectable()
export class JwtSigner {
  constructor(
    private config: JwtConfig,
    private mapper: Mapper,
  ) {}

  async signAccessToken<D extends IStorableData>(
    info: D | JwtRefreshToken<any>,
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
}
