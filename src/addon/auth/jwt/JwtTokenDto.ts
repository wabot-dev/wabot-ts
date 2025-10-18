import { isDate, isNotEmpty, isString } from '@/core/validation'

export class JwtTokenDto {
  @isString()
  @isNotEmpty()
  token?: string

  @isDate()
  expiration?: Date
}
