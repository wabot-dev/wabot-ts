import type { IChatMessage, IConnectionChatMessage } from '@/core'

export type IWhatsAppMessageListener = (message: IConnectionChatMessage) => Promise<void>

export interface IWhatsAppConnection {
  listenMessage(businessNumber: string, listener: IWhatsAppMessageListener): void
  sendWhatsApp(businessNumber: string, to: string, replyMessage: IChatMessage): Promise<void>
  connect(): void
}
