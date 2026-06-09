import { IReceivedMessage } from '@/feature/chat-controller'
import { slackChannelName } from './slackChannelName'

export interface ISlackReceivedMessage extends IReceivedMessage {
  channel: typeof slackChannelName
}
