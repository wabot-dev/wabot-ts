import { IChatConnection } from '@/feature/chat-bot'
import { IKapsoReceivedMessage } from './IKapsoReceivedMessage'

export interface IKapsoChannelMessage extends IKapsoReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
