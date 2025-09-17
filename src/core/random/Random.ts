import { randomBytes } from 'node:crypto'

const DIGITS = '0123456789'
const ALPHA_NUMERIC_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const ALPHA_NUMERIC_LOWER_CASE_CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export class Random {
  static integer(options: { min: number; max: number }): number {
    const { min, max } = options
    if (min > max) {
      throw new RangeError('min must be less than or equal to max')
    }

    const range = max - min + 1
    if (range <= 0) {
      throw new RangeError('Range must be a positive number')
    }

    const byteSize = 6 // gives us up to 2^48
    const maxGeneratedValue = Math.pow(2, byteSize * 8) - 1
    const maxAcceptable = maxGeneratedValue - (maxGeneratedValue % range)

    let randomNumber: number
    do {
      randomNumber = parseInt(randomBytes(byteSize).toString('hex'), 16)
    } while (randomNumber >= maxAcceptable)

    return min + (randomNumber % range)
  }

  static slug(name: string, options: { randomLength: number }): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[\s\_]+/g, '-') // spaces/underscores to hyphens
      .replace(/[^a-z0-9\-]/g, '') // remove non-alphanumeric except hyphens
      .replace(/\-+/g, '-') // collapse multiple hyphens
      .replace(/^\-+|\-+$/g, '') // trim hyphens from ends

    const random = this.alphaNumericLowerCase(options.randomLength)
    return `${base}-${random}`
  }

  static alphaNumeric(length: number): string {
    const bytes = randomBytes(length)
    let result = ''

    for (let i = 0; i < length; i++) {
      const index = bytes[i] % ALPHA_NUMERIC_CHARSET.length
      result += ALPHA_NUMERIC_CHARSET[index]
    }

    return result
  }

  static alphaNumericLowerCase(length: number): string {
    const bytes = randomBytes(length)
    let result = ''

    for (let i = 0; i < length; i++) {
      const index = bytes[i] % ALPHA_NUMERIC_LOWER_CASE_CHARSET.length
      result += ALPHA_NUMERIC_LOWER_CASE_CHARSET[index]
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
