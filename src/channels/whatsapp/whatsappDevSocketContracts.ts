import type { IChatMessage } from '@/core'

export const devWhatsAppListentEvent = {
  DEV_WATSAPP_WEBHOOK: 'dev-whatsapp-webhook',
} as const

export const devWhatsappEmitEvent = {
  DEV_CONNECTION: 'dev-connection',
  DEV_SEND_WHATSAPP: 'dev-send-whatsapp',
} as const

export interface IDevConnectionRequest {
  token: string
}

export interface IDevSendWhatsappRequest {
  from: string
  to: string
  message: IChatMessage
}
