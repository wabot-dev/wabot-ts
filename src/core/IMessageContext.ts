
import type { Chat } from './chat'
import { type IChatMessage, type IReceivedChatMessage } from './message'
import type { IUser, User } from './user'

export interface IMessageContext {
  message: IReceivedChatMessage
  chat: Chat
  user?: User
  reply: (message: IChatMessage) => void
}

export class MessageContext implements IMessageContext {
  constructor(
    public message: IReceivedChatMessage,
    public chat: Chat,
    public user: User | undefined,
    public reply: (message: IChatMessage) => void,
  ) {}
}
