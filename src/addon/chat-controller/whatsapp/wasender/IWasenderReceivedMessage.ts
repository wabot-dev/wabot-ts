import { IReceivedMessage } from '@/feature/chat-controller'
import { IWasenderChatMessage } from './IWasenderChatMessage'
import { wasenderChannelName } from './WasenderChannelName'

export interface IWasenderReceivedMessage extends IReceivedMessage {
  channel: typeof wasenderChannelName
  message: IWasenderChatMessage
}
