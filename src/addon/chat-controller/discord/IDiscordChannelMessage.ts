import { IChatConnection } from '@/feature/chat-bot'
import { IDiscordReceivedMessage } from './IDiscordReceivedMessage'

export interface IDiscordChannelMessage extends IDiscordReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
