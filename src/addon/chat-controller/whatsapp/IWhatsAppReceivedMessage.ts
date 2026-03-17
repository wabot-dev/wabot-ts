import { IReceivedMessage } from '@/feature/chat-controller'
import { whatsAppChannelName } from './whatsAppChannelName'

export interface IWhatsAppReceivedMessage extends IReceivedMessage {
  channel: typeof whatsAppChannelName
}
