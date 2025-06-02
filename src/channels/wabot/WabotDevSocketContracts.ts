import type { IChatMessage } from '@/core'

export type IWhatsAppTemplateParameter =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'currency'
      currency: {
        fallback_value: string
        code: string
        amount_1000: number
      }
    }
  | {
      type: 'date_time'
      date_time: {
        fallback_value: string
      }
    }

export interface IWhatsAppTemplateMessage {
  templateName: string
  languageCode: string
  parameters: IWhatsAppTemplateParameter[]
}

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
