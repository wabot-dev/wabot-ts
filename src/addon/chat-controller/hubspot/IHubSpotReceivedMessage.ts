import { IReceivedMessage } from '@/feature/chat-controller'
import { hubspotChannelName } from './hubspotChannelName'

export interface IHubSpotReceivedMessage extends IReceivedMessage {
  channel: typeof hubspotChannelName
}
