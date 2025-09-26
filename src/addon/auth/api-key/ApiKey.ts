import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { Password } from '@/core/password'
import { IStorableData } from '@/core/storable'

export interface IApiKeyData<A extends IStorableData> extends IEntityData {
  passwordHash?: string
  authInfo: A
  name: string
}

export class ApiKey<A extends IStorableData> extends Entity<IApiKeyData<A>> {
  get authInfo() {
    return this.data.authInfo
  }

  setAuthInfo(authInfo: A) {
    this.data.authInfo = authInfo
  }

  generatePassword(): string {
    if (this.data.passwordHash) {
      throw new Error('This api key, already has a secret')
    }
    const password = Password.generate(64)
    this.data.passwordHash = Password.hash({ password: password })
    return password
  }

  isValidPassword(password: string) {
    if (!this.data.passwordHash) return false
    return Password.isValid({ password: password, hash: this.data.passwordHash })
  }

  validatePassword(password: string) {
    if (!this.isValidPassword(password)) {
      throw new CustomError({ message: 'invalid api key', httpCode: 401 })
    }
  }

  static inflate(secret: string): { id: string; pass: string } {
    try {
      const json = Buffer.from(secret, 'base64').toString('utf-8')
      const data = JSON.parse(json)
      if (!data.id || !data.pass) {
        throw new Error('invalid secret structure')
      }
      return data
    } catch (err) {
      throw new Error('fail to inflate secret: ' + (err as Error).message)
    }
  }

  static deflate(data: { id: string; pass: string }): string {
    const { id, pass } = data
    if (!id || !pass) {
      throw new Error('id and pass required')
    }
    const json = JSON.stringify({ id, pass })
    return Buffer.from(json, 'utf-8').toString('base64')
  }
}
