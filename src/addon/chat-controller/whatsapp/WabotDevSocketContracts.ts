import type { IChatMessage } from '@/feature/chat-bot'
import { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'

export const devListentEvent = {
  DEV_WATSAPP_WEBHOOK: 'dev-whatsapp-webhook',
} as const

export const devEmitEvent = {
  DEV_CONNECTION: 'dev-connection',
  DEV_SEND_WHATSAPP: 'dev-send-whatsapp',
  DEV_SEND_WHATSAPP_TEMPLATE: 'dev-send-whatsapp-template',
} as const

export interface IDevConnectionRequest {
  token: string
}

export interface IDevSendWhatsappRequest {
  from: string
  to: string
  message: IChatMessage
}

export interface IDevSendWhatsappTemplateRequest {
  from: string
  to: string
  message: IWhatsAppTemplateMessage
}
