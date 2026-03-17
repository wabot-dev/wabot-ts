import { IChatMessage } from '@/feature/chat-bot'

export interface IWhatsAppByWasenderChatMessage extends IChatMessage {
  metadata: {
    whatsAppNumber: string
  }
}
