import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import crypto from 'node:crypto'

export interface IJwtRefreshTokenData<A extends object> extends IEntityData {
  secretHash?: string
  metadata?: Record<string, string>
  authInfo: A
  expirationTime: number
  revokedAt?: number
}

export class JwtRefreshToken<A extends object> extends Entity<IJwtRefreshTokenData<A>> {
  static PREFIX = 'rt_'

  static hashSecret(secret: string) {
    return crypto.createHash('sha256').update(secret).digest('hex')
  }

  get authInfo() {
    return this.data.authInfo
  }

  get metadata() {
    return this.data.metadata ?? {}
  }

  get expirationTime() {
    return new Date(this.data.expirationTime)
  }

  isExpired(): boolean {
    return Date.now() > this.data.expirationTime
  }

  revoke() {
    this.data.revokedAt = Date.now()
  }

  isRevoked(): boolean {
    return this.data.revokedAt != null
  }

  generateSecret(): string {
    if (this.data.secretHash) {
      throw new Error('This Token key already has a secret')
    }
    const secret = `${JwtRefreshToken.PREFIX}${crypto.randomBytes(32).toString('hex')}`
    this.data.secretHash = JwtRefreshToken.hashSecret(secret)
    return secret
  }

  isValidSecret(secret: string): boolean {
    if (!secret.startsWith(JwtRefreshToken.PREFIX)) return false
    if (!this.data.secretHash) return false

    const hashed = JwtRefreshToken.hashSecret(secret)
    const stored = this.data.secretHash

    const hashedBuf = Buffer.from(hashed, 'hex')
    const storedBuf = Buffer.from(stored, 'hex')

    return hashedBuf.length === storedBuf.length && crypto.timingSafeEqual(hashedBuf, storedBuf)
  }

  isValidToken(secret: string): boolean {
    if (this.isExpired()) return false
    if (this.isRevoked()) return false
    return this.isValidSecret(secret)
  }

  validateToken(secret: string) {
    if (!this.isValidToken(secret)) {
      throw new CustomError({ message: 'Invalid Token', httpCode: 401 })
    }
  }
}
