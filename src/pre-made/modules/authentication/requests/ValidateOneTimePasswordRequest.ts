import { param } from '@/mindset'

export class ValidateOneTimePasswordRequest {
  @param({
    description: 'User Email',
  })
  userEmail: string = ''

  @param({
    description: 'Otp provided by the User',
  })
  otp: string = ''
}
