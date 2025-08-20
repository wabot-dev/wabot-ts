import { randomBytes } from 'node:crypto'

const DIGITS = '0123456789'
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export class Random {
  static slug(name: string, options: { randomLength: number }): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[\s\_]+/g, '-') // spaces/underscores to hyphens
      .replace(/[^a-z0-9\-]/g, '') // remove non-alphanumeric except hyphens
      .replace(/\-+/g, '-') // collapse multiple hyphens
      .replace(/^\-+|\-+$/g, '') // trim hyphens from ends

    const random = this.string(options.randomLength)
    return `${base}-${random}`
  }

  static string(length: number): string {
    const bytes = randomBytes(length)
    let result = ''

    for (let i = 0; i < length; i++) {
      const index = bytes[i] % CHARSET.length
      result += CHARSET[index]
    }

    return result
  }

  static numberCode(length: number): string {
    const bytes = randomBytes(length)
    let result = ''

    for (let i = 0; i < length; i++) {
      const index = bytes[i] % 10 // 0–9
      result += DIGITS[index]
    }

    return result
  }
}
