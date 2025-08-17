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
  WhatsAppSender,
  WhatsAppSenderByDevConnection,
} from '@'
import { Pool } from 'pg'
import { EliaChatController } from './EliaChatController'
import { EliaEmailService } from './services'

import { EliaEventRestController } from './EliaEventRestController'

container.registerInstance(
  Pool,
  new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
)

runServer({
  controllers: [EliaChatController, EliaEventRestController],
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
    {
      replace: WhatsAppSender,
      with: WhatsAppSenderByDevConnection
    }
  ],
})
