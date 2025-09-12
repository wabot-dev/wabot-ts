import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { Random } from '../random'

export interface PasswordHashOptions {
  password: string
  saltLength?: number // Default: 16
  keyLength?: number // Default: 64
}

export class Password {
  static hash(options: PasswordHashOptions): string {
    const { password: secret, saltLength = 16, keyLength = 64 } = options

    const salt = randomBytes(saltLength).toString('hex')
    const derivedKey = scryptSync(secret, salt, keyLength)
    return `${salt}:${derivedKey.toString('hex')}`
  }

  static isValid(req: { password: string; hash: string }): boolean {
    const [salt, storedKeyHex] = req.hash.split(':')
    if (!salt || !storedKeyHex) return false

    try {
      const keyLength = Buffer.from(storedKeyHex, 'hex').length
      const derivedKey = scryptSync(req.password, salt, keyLength)
      const storedKey = Buffer.from(storedKeyHex, 'hex')

      return timingSafeEqual(derivedKey, storedKey)
    } catch {
      return false
    }
  }

  static generate(length: number) {
    return Random.string(length)
  }
}
