import { IReceivedMessage } from '@/feature/chat-controller'
import { discordChannelName } from './discordChannelName'

export interface IDiscordReceivedMessage extends IReceivedMessage {
  channel: typeof discordChannelName
}
