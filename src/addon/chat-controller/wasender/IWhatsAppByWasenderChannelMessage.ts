import { IChatConnection } from '@/feature/chat-bot'
import { IWhatsAppByWasenderReceivedMessage } from './IWhatsAppByWasenderReceivedMessage'

export interface IWhatsAppByWasenderChannelMessage extends IWhatsAppByWasenderReceivedMessage {
  chatConnection: IChatConnection
  injectInstances?: [any, any][]
}
