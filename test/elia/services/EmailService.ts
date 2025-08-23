import { injectable} from '@'
import { Resend } from 'resend'

interface ISendEmailRequest {
  from: string,
  to: string,
  subject: string,
  html: string
}

@injectable()
export class EliaEmailService {
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
