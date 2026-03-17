import { IChatConnection } from '@/feature/chat-bot'
import { ISocketReceivedMessage } from './ISocketReceivedMessage'

export interface ISocketChannelMessage extends ISocketReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
