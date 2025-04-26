import { MessageContext, User, UserRepository } from '@/core'
import { mindsetFunction, mindsetModule } from '@/mindset'
import { EmailService } from '../../services/EmailService'
import { OtpService } from '../../services/OtpService'
import { SendOneTimePasswordRequest, ValidateOneTimePasswordRequest } from './requests'

@mindsetModule({
  description: 'Provide authentication methods',
  language: 'english',
})
export class AuthenticationModule {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private otpService: OtpService,
    private context: MessageContext,
  ) {}

  @mindsetFunction({
    description: 'Send an One Time Password to the user when want authenticate',
  })
  async sendOneTimePassword(request: SendOneTimePasswordRequest) {
    const user = await this.userRepository.findByConnection({
      channelName: 'EmailChannel',
      id: request.toEmail,
    })
    if (!user) return 'success'

    const otp = await this.otpService.generate()
    const html = await this.generateOtpEmailHtml(otp, user)
    const subject = await this.generateOtpEmailSubject()

    await this.emailService.sendEmail({
      from: request.fromEmail,
      to: request.toEmail,
      subject,
      html,
    })

    user.setValue('OTP', otp)
    await this.userRepository.update(user)

    return 'success'
  }

  @mindsetFunction({
    description: 'Send an One Time Password to the user when want authenticate',
  })
  async validateOneTimePassword(request: ValidateOneTimePasswordRequest) {
    const user = await this.userRepository.findByConnection({
      channelName: 'EmailChannel',
      id: request.userEmail,
    })
    if (!user) {
      throw new Error('Invalid OTP')
    }

    const otp = user.getValue('OTP')
    if (otp !== request.otp) {
      throw new Error('Invalid OTP')
    }

    user.addConnection(this.context.message.userConnection)
    await this.userRepository.update(user)

    return 'success'
  }

  protected async generateOtpEmailHtml(otp: string, user: User): Promise<string> {
    return `<p>Your OTP Code is ${otp}</p>`
  }

  protected async generateOtpEmailSubject(): Promise<string> {
    return 'OTP Code'
  }
}
