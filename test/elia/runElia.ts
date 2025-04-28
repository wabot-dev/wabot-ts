import {
  ChatBotAdapter,
  ChatRepository,
  EmailService,
  OpenaiChatBotAdapter,
  RamUserRepository,
  runServer,
  SqliteChatRepository,
  UserRepository,
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
      with: SqliteChatRepository,
      singleton: true,
    },
    {
      replace: UserRepository,
      with: RamUserRepository,
      singleton: true,
    },
  ],
})
