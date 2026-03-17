import { IChatConnection } from '@/feature/chat-bot'
import { IWhatsAppReceivedMessage } from './IWhatsAppReceivedMessage'

export interface IWhatsAppChannelMessage extends IWhatsAppReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
