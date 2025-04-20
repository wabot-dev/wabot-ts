import { ISystemMessageItem } from '@/chatbot'

export interface IChatContext {
  chatId: string
  out: (message: ISystemMessageItem) => void
}

export interface IContext {
  userId: string
  chat: IChatContext
}

export class Context implements IContext {
  constructor(
    public userId: string,
    public chat: IChatContext,
  ) {}
}
