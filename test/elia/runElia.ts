import {
  ChatBotAdapter,
  ChatRepository,
  container,
  EmailService,
  EnvWhatsAppRepository,
  OpenaiChatBotAdapter,
  PgChatRepository,
  PgUserRepository,
  runServer,
  UserRepository,
  WhatsAppRepository,
} from '@'
import { Pool } from 'pg'
import { EliaChatController } from './EliaChatController'
import { EliaEmailService } from './services'

container.registerInstance(
  Pool,
  new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
)

runServer({
  controllers: [EliaChatController],
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
      with: PgChatRepository,
    },
    {
      replace: UserRepository,
      with: PgUserRepository,
    },
    {
      replace: WhatsAppRepository,
      with: EnvWhatsAppRepository,
    },
  ],
})
