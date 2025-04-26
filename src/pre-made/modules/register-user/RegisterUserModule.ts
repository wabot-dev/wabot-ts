import { User, MessageContext, UserRepository } from '@/core'
import { mindsetFunction, mindsetModule } from '@/mindset'
import { RegisterUserWithEmailRequest } from './requests/RegisterUserWithEmailRequest'

@mindsetModule({
  description: 'Provide functions to register an user',
  language: 'english',
})
export class RegisterUserModule {
  constructor(
    private userRepository: UserRepository,
    private context: MessageContext,
  ) {}

  @mindsetFunction({
    description: 'Register a new user using email',
  })
  async registerUserWithEmail(request: RegisterUserWithEmailRequest) {
    if (this.context.user) {
      throw new Error('The User is already authenticated')
    }

    const user = new User({
      shortName: request.shortName,
      connections: [
        {
          channelName: 'EmailChannel',
          id: request.email,
        },
      ],
      keyValueData: {},
    })

    await this.userRepository.create(user)
    return 'success'
  }
}
