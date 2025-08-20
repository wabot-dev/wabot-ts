import { isDate, isNotEmpty, isString } from '@/validation'

export class JwtTokenDto {
  @isString()
  @isNotEmpty()
  token?: string

  @isDate()
  expiration?: Date
}
