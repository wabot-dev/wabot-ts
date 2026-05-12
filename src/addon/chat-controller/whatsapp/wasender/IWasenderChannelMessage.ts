import { IChatConnection } from '@/feature/chat-bot'
import { IWasenderReceivedMessage } from './IWasenderReceivedMessage'

export interface IWasenderChannelMessage extends IWasenderReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
