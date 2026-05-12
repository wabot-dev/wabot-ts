import type { IChatMessage } from '@/feature/chat-bot'

export type IWhatsAppTemplateParameter =
  | {
      type: 'text'
      text: string
      parameter_name?: string
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

export interface IWhatsAppTemplateData {
  templateName: string
  languageCode: string
  parameters: IWhatsAppTemplateParameter[]
}

export interface ISendWhatsAppMessageReq {
  from: string
  to: string
  message: IChatMessage
}

export interface ISendWhatsAppTemplateReq {
  from: string
  to: string
  templateData: IWhatsAppTemplateData
  senderName: string
}

export interface IWhatsAppSender {
  sendMessage(request: ISendWhatsAppMessageReq): Promise<void>
  sendTemplate(request: ISendWhatsAppTemplateReq): Promise<void>
}
