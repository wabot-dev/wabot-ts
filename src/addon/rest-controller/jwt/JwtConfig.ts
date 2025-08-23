
import { Env } from '@/core/env'
import { singleton } from '@/core/injection'
import { Algorithm } from 'jsonwebtoken'

@singleton()
export class JwtConfig {
  secretOrPublicKey: string
  secretOrPrivateKey: string
  algorithm: Algorithm
  accessExpirationSeconds: number
  refreshExpirationSeconds: number

  constructor(env: Env) {
    this.algorithm = env.requireString('JWT_ALGORITHM', { default: 'HS256' }) as Algorithm
    this.secretOrPublicKey = env.requireString('JWT_SECRET')
    this.secretOrPrivateKey = env.requireString('JWT_SECRET')
    this.accessExpirationSeconds = env.requireNumber('JWT_ACCESS_EXPIRATION_SECONDS', {
      default: 10 * 60,
    })
    this.refreshExpirationSeconds = env.requireNumber('JWT_REFRESH_EXPIRATION_SECONDS', {
      default: 365 * 24 * 3600,
    })
  }
}
