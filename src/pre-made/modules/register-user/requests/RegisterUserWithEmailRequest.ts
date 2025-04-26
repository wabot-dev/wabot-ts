import { param } from '@/mindset'

export class RegisterUserWithEmailRequest {
  @param({
    description: 'Email of the User',
  })
  email: string = ''

  @param({
    description: 'ShortName for the new User',
  })
  shortName: string = ''
}
