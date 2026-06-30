import { IChatMessage } from '@/feature/chat-bot'

export interface IDiscordMetadata extends Record<string, string> {
  botUserId: string
  wasBotMentioned: string
  wasEveryoneMentioned: string
  isDirectMessage: string
}

export interface IDiscordChatMessage extends IChatMessage {
  metadata?: IDiscordMetadata
}
