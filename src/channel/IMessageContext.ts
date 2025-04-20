import { IChatType } from '@/chat'
import { IChatContext } from '@/context'

export interface IMessageOrigin {
  chatId: string
  chatType: IChatType
  channelType: Function
}

export interface IMessageContext extends IChatContext {
  origin: IMessageOrigin
}
