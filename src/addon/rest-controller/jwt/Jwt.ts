import { JwtAccessAndRefreshTokenDto } from './JwtAccessAndRefreshTokenDto'

import { JwtSigner } from './JwtSigner'
import { JwtRefreshTokenRepository } from './JwtRefreshTokenRepository'
import { JwtRefreshToken } from './JwtRefreshToken'
import { injectable } from '@/core/injection'
import { Auth } from '@/core/auth'


@injectable()
export class Jwt {
  constructor(
    private auth: Auth<any>,
    private jwtSigner: JwtSigner,
    private jwtRefreshTokenRepository: JwtRefreshTokenRepository<any>,
  ) {}

  async createToken(): Promise<JwtAccessAndRefreshTokenDto> {
    const authInfo = this.auth.require()
    const refreshToken = new JwtRefreshToken({ authInfo })
    await this.jwtRefreshTokenRepository.create(refreshToken)
    return await this.jwtSigner.signAccessAndRefreshToken(refreshToken)
  }
}
