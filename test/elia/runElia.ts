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
import { EliaController } from './EliaController'
import { EliaEmailService } from './services'

container.registerInstance(
  Pool,
  new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
)

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
