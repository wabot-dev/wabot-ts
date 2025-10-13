import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { IStorableData } from '@/core/storable'
import crypto from 'node:crypto'

export interface IApiKeyData<A extends IStorableData> extends IEntityData {
  secretHash?: string
  metadata?: Record<string, string>
  authInfo: A
  name: string
}

export class ApiKey<A extends IStorableData> extends Entity<IApiKeyData<A>> {
  static PREFIX = 'sk_'

  static hashSecret(secret: string) {
    return crypto.createHash('sha256').update(secret).digest('hex')
  }

  get authInfo() {
    return this.data.authInfo
  }

  get metadata() {
    return this.data.metadata ?? {}
  }

  setAuthInfo(authInfo: A) {
    this.data.authInfo = authInfo
  }

  generateSecret(): string {
    if (this.data.secretHash) {
      throw new Error('This API key already has a secret')
    }
    const secret = `${ApiKey.PREFIX}${crypto.randomBytes(32).toString('hex')}`
    this.data.secretHash = ApiKey.hashSecret(secret)
    return secret
  }

  isValidSecret(secret: string): boolean {
    if (!secret.startsWith(ApiKey.PREFIX)) return false
    if (!this.data.secretHash) return false
    const hashed = ApiKey.hashSecret(secret)
    const stored = this.data.secretHash

    const hashedBuf = Buffer.from(hashed, 'hex')
    const storedBuf = Buffer.from(stored, 'hex')

    return hashedBuf.length === storedBuf.length && crypto.timingSafeEqual(hashedBuf, storedBuf)
  }

  validateSecret(secret: string): void {
    if (!this.isValidSecret(secret)) {
      throw new CustomError({ message: 'Invalid API key', httpCode: 401 })
    }
  }
}
