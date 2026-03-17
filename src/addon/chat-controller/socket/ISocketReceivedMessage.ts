import { IReceivedMessage } from '@/feature/chat-controller'
import { socketChannelName } from './socketChannelName'

export interface ISocketReceivedMessage extends IReceivedMessage {
  channel: typeof socketChannelName
}
