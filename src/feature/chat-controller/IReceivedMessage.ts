import { IChatMessage } from '@/feature/chat-bot'

export interface IReceivedMessage {
  message: IChatMessage
  reply: (message: IChatMessage) => Promise<Record<string, string> | void>
  extras?: Record<string, unknown>
}
