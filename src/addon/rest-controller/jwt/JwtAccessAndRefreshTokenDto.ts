
import { isModel } from '@/core/validation'
import { JwtTokenDto } from './JwtTokenDto'

export class JwtAccessAndRefreshTokenDto {
  @isModel(JwtTokenDto)
  access?: JwtTokenDto

  @isModel(JwtTokenDto)
  refresh?: JwtTokenDto
}
