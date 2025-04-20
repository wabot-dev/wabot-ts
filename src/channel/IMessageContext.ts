import { IChatContext } from '@/context'

export interface IMessageOrigin {
  phone?: string
  email?: string
  groupId?: string
  channelType: Function
}

export interface IMessageContext extends IChatContext {
  origin: IMessageOrigin
}
