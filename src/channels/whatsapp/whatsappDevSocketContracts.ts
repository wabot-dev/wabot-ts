import type { IChatMessage } from '@/core'
import type { IWhatsAppTemplateMessage } from './IWhatsAppTemplateMessage'

export const devWhatsAppListentEvent = {
  DEV_WATSAPP_WEBHOOK: 'dev-whatsapp-webhook',
} as const

export const devWhatsappEmitEvent = {
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
