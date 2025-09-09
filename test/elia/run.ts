import {
  ChatAdapter,
  ChatRepository,
  container,
  Env,
  PgChatRepository,
  runChatControllers,
  WabotChatAdapter,
} from '@'
import { Pool } from 'pg'
import { EliaChatController } from './EliaChatController'

const env = container.resolve(Env)

// Set Database Url
container.registerInstance(Pool, new Pool({ connectionString: env.requireString('DATABASE_URL') }))

// Set Chat Adapter
container.registerType(ChatAdapter, WabotChatAdapter)

// Set Chat Repository
container.registerType(ChatRepository, PgChatRepository)

// Run chat controllers
runChatControllers([EliaChatController])
