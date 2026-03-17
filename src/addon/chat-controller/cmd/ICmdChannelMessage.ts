import { IChatConnection } from '@/feature/chat-bot'
import { ICmdReceivedMessage } from './ICmdReceivedMessage'

export interface ICmdChannelMessage extends ICmdReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
