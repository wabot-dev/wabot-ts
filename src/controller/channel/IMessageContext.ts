import { type IChatType } from '@/chatbot/chat'
import { type IChatContext } from '@/context'

export interface IMessageOrigin {
  chatId: string
  chatType: IChatType
  channelType: Function
}

export interface IMessageContext extends IChatContext {
  origin: IMessageOrigin
}
