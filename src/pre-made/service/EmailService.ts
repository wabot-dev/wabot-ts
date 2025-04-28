import { injectable } from '@/injection'

export interface ISendEmailRequest {
  from: string
  to: string
  subject: string
  html: string
}

export interface IEmailService {
  sendEmail(request: ISendEmailRequest): Promise<void>
}

@injectable()
export class EmailService implements IEmailService {
  async sendEmail(request: ISendEmailRequest): Promise<void> {
    throw new Error('Not implemented')
  }
}
