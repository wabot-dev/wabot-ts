import { IReceivedMessage } from '@/feature/chat-controller'
import { cmdChannelName } from './cmdChannelName'

export interface ICmdReceivedMessage extends IReceivedMessage {
  channel: typeof cmdChannelName
}
