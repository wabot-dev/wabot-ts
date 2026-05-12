import {
  ChatRepository,
  container,
  Env,
  Locker,
  OpenaiChatAdapter,
  PgChatRepository,
  PgLocker,
  runChatAdapters,
  runChatControllers,
} from '@'
import { Pool } from 'pg'
import { EliaChatController } from './EliaChatController'

const env = container.resolve(Env)

// Set Database Url
container.registerInstance(Pool, new Pool({ connectionString: env.requireString('DATABASE_URL') }))

container.registerType(Locker, PgLocker)

// Register chat adapters (the first one is the default for refs without `provider`)
runChatAdapters([OpenaiChatAdapter])

// Set Chat Repository
container.registerType(ChatRepository, PgChatRepository)

// Run chat controllers
runChatControllers([EliaChatController])
