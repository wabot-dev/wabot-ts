import {
  ChatBotAdapter,
  ChatRepository,
  container,
  EmailService,
  OpenaiChatBotAdapter,
  PgChatRepository,
  PgUserRepository,
  runServer,
  UserRepository,
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
      // with: SqliteChatRepository,
      with: PgChatRepository,
    },
    {
      replace: UserRepository,
      // with: SqliteUserRepository,
      with: PgUserRepository,
    },
  ],
})
