import { IReceivedMessage } from '@/feature/chat-controller'
import { IDiscordChatMessage } from './IDiscordChatMessage'
import { discordChannelName } from './discordChannelName'

export interface IDiscordReceivedMessage extends IReceivedMessage {
  channel: typeof discordChannelName
  message: IDiscordChatMessage
}
