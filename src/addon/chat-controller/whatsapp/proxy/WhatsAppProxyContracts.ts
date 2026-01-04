import { IWhatsAppProxyMessage } from './IWhatsAppProxyMessage'

export const WHATSAPP_PROXY_SEND_MESSAGE_EVENT = 'sendMessage' as const

export interface IWhatsAppProxySendMessageEventReq {
  event: typeof WHATSAPP_PROXY_SEND_MESSAGE_EVENT
  data: IWhatsAppProxyMessage
}

export const WHATSAPP_PROXY_LISTEN_MESSAGE_EVENT = 'listenMessage' as const

export interface IWhatsAppProxyListenMessageEventReq {
  event: typeof WHATSAPP_PROXY_LISTEN_MESSAGE_EVENT
  data: IWhatsAppProxyListenMessageEventData
}

export interface IWhatsAppProxyListenMessageEventData {
  from?: string[]
  to: string
}

export const WHATSAPP_MESSAGE_EVENT = 'message' as const

export interface IWhatsAppProxyMessageEventReq {
  event: typeof WHATSAPP_MESSAGE_EVENT
  data: IWhatsAppProxyMessage
}
