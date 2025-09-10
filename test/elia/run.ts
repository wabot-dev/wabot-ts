import {
  ChatAdapter,
  ChatRepository,
  container,
  Env,
  PgChatRepository,
  runChatControllers,
  WabotChatAdapter,
  WhatsAppReceiver,
  WhatsAppReceiverByWabotProxy,
  WhatsAppSender,
  WhatsAppSenderByWabotProxy,
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

// Set WhatsApp implementation
container.registerType(WhatsAppSender, WhatsAppSenderByWabotProxy)
container.registerType(WhatsAppReceiver, WhatsAppReceiverByWabotProxy)

// Run chat controllers
runChatControllers([EliaChatController])
