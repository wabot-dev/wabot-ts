import { IReceivedMessage } from './IReceivedMessage'
import { Chat } from '@/feature/chat-bot'

export interface IMessageContext extends IReceivedMessage {
  chat: Chat
  authInfo?: object
}
