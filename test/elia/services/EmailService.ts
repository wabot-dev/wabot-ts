import { injectable, type IEmailService, type ISendEmailRequest } from '@'
import { Resend } from 'resend'

@injectable()
export class EliaEmailService implements IEmailService {
  private resend = new Resend()

  async sendEmail(request: ISendEmailRequest): Promise<void> {
    const response = await this.resend.emails.send({
      from: request.from,
      to: request.to,
      subject: request.subject,
      html: request.html,
    })

    if (response.error) {
      throw response.error
    }
  }
}
