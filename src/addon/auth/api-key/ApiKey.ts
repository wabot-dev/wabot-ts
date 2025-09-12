import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { Password } from '@/core/password'
import { IStorableData } from '@/core/storable'

export interface IApiKeyData extends IEntityData {
  passwordHash?: string
  authInfo: IStorableData
}

export interface IApiKeySecretData {
  id: string
  pass: string
}

export class ApiKey extends Entity<IApiKeyData> {
  get authInfo() {
    return this.data.authInfo
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
      throw new CustomError({ message: 'Invalid Api key', httpCode: 401 })
    }
  }

  static inflate(secret: string): IApiKeySecretData {
    try {
      const json = Buffer.from(secret, 'base64').toString('utf-8')
      const data = JSON.parse(json)
      if (!data.id || !data.pass) {
        throw new Error('Invalid secret structure')
      }
      return data
    } catch (err) {
      throw new Error('Failed to inflate secret: ' + (err as Error).message)
    }
  }

  static deflate(data: IApiKeySecretData): string {
    const json = JSON.stringify(data)
    return Buffer.from(json, 'utf-8').toString('base64')
  }
}
