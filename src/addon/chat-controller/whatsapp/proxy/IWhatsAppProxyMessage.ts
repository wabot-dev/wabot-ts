import { IWhatsAppProxyMessageContent } from './IWhatsAppProxyMessageContent'

export interface IWhatsAppProxyMessage {
  from: string
  to: string
  senderName?: string
  content: IWhatsAppProxyMessageContent
}
