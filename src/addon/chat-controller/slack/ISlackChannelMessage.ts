import { IChatConnection } from '@/feature/chat-bot'
import { ISlackReceivedMessage } from './ISlackReceivedMessage'

export interface ISlackChannelMessage extends ISlackReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
