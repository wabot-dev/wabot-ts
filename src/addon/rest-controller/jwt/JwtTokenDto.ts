import { isDate, isNotEmpty, isString } from '@/addon/validation'

export class JwtTokenDto {
  @isString()
  @isNotEmpty()
  token?: string

  @isDate()
  expiration?: Date
}
