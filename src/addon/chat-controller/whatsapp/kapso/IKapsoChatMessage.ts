import { IChatMessage } from '@/feature/chat-bot'

export interface IKapsoChatMessage extends IChatMessage {
  metadata: {
    whatsAppNumber: string
  }
}
