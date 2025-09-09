import { IWhatsAppProxyMessage } from './IWhatsAppProxyMessage'

export const WHATSAPP_SEND_MESSAGE_EVENT = 'sendMessage' as const
export interface IWhatsAppSendMessageEventReq {
  event: typeof WHATSAPP_SEND_MESSAGE_EVENT
  data: IWhatsAppProxyMessage
}

export const WHATSAPP_MESSAGE_EVENT = 'message' as const
export interface IWhatsAppMessageEventReq {
  event: typeof WHATSAPP_MESSAGE_EVENT
  data: IWhatsAppProxyMessage
}
