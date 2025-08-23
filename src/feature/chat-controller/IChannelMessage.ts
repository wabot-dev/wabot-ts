import { IChatConnection } from '@/feature/chat-bot'
import { IReceivedMessage } from './IReceivedMessage'

export interface IChannelMessage extends IReceivedMessage {
  chatConnection: IChatConnection
}
