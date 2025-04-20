import { IChatMessage } from '@/message'

export interface IChatContext {
  chatId: string
  message: IChatMessage
  reply: (message: IChatMessage) => void
}

export interface IUserContext {
  userId: string
}

export interface IContext {
  user?: IUserContext
  chat: IChatContext
}

export class Context implements IContext {
  constructor(
    public chat: IChatContext,
    public user?: IUserContext,
  ) {}
}
