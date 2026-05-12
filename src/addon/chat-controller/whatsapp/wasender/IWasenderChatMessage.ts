import { IChatMessage } from '@/feature/chat-bot'

export interface IWasenderChatMessage extends IChatMessage {
  metadata: {
    whatsAppNumber: string
  }
}
