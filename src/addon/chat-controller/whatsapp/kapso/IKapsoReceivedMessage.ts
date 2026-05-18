import { IReceivedMessage } from '@/feature/chat-controller'
import { IKapsoChatMessage } from './IKapsoChatMessage'
import { kapsoChannelName } from './KapsoChannelName'

export interface IKapsoReceivedMessage extends IReceivedMessage {
  channel: typeof kapsoChannelName
  message: IKapsoChatMessage
}
