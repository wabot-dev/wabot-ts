import {
  ChatBotAdapter,
  ChatRepository,
  EmailService,
  OpenaiChatBotAdapter,
  runServer,
  SqliteChatRepository,
  SqliteUserRepository,
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
    },
    {
      replace: UserRepository,
      with: SqliteUserRepository,
    },
  ],
})
