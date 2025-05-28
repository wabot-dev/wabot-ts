import type { IChatMessage, IConnectionChatMessage } from '@/core'
import type { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'

export type IWhatsAppMessageListener = (message: IConnectionChatMessage) => Promise<void>

export interface IWhatsAppConnection {
  listenMessage(businessNumber: string, listener: IWhatsAppMessageListener): void
  sendWhatsApp(businessNumber: string, to: string, message: IChatMessage): Promise<void>
  sendWhatsAppTemplate(
    businessNumber: string,
    to: string,
    templateMessage: IWhatsAppTemplateMessage,
  ): Promise<void>
  connect(): void
}
