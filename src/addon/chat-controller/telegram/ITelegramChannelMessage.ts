import { IChatConnection } from '@/feature/chat-bot'
import { ITelegramReceivedMessage } from './ITelegramReceivedMessage'

export interface ITelegramChannelMessage extends ITelegramReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
