import { param } from '@/mindset'

export class SendOneTimePasswordRequest {
  @param({
    description: 'Sender Email address',
  })
  fromEmail: string = ''

  @param({
    description: 'Recipient Email Address, to send one time password',
  })
  toEmail: string = ''
}
