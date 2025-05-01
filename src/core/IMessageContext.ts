import type { Chat } from './chat/Chat'
import type { IConnectionChatMessage } from './IConnectionChatMessage'

import { User } from './user'

export interface IMessageContext {
  message: IConnectionChatMessage
  chat: Chat
  user: User | null
}

export class MessageContext implements IMessageContext {
  constructor(
    public message: IConnectionChatMessage,
    public chat: Chat,
    public user: User | null,
  ) {}
}
