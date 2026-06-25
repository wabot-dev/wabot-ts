import { IChatConnection } from '@/feature/chat-bot'
import { IHubSpotReceivedMessage } from './IHubSpotReceivedMessage'

export interface IHubSpotChannelMessage extends IHubSpotReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
