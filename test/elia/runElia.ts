import {
  runServer,
  EmailService,
  ChatRepository,
  RamChatMemory,
  ChatBotAdapter,
  OpenaiChatBotAdapter,
  UserRepository,
  RamUserRepository,
  RamChatRepository,
} from '@'
import { EliaController } from './EliaController'
import { EliaEmailService } from './services'

runServer({
  controllers: [EliaController],
  providers: [
    {
      replace: ChatBotAdapter,
      with: OpenaiChatBotAdapter,
    },
    {
      replace: EmailService,
      with: EliaEmailService,
    },
    {
      replace: ChatRepository,
      with: RamChatRepository,
      singleton: true,
    },
    {
      replace: UserRepository,
      with: RamUserRepository,
      singleton: true,
    },
  ],
})
