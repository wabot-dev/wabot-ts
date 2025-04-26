import type { Chat } from './chat/Chat'
import type { IConnectionChatMessage } from './IReceivedMessage'

import { User } from './user'

export interface IMessageContext {
  message: IConnectionChatMessage
  chat: Chat
  user?: User
}

export class MessageContext implements IMessageContext {
  constructor(
    public message: IConnectionChatMessage,
    public chat: Chat,
    public user: User | undefined
  ) {}
}
