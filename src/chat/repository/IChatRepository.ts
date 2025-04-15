import { Chat, IChatType } from '../Chat'

export interface IChatQuery {
  chatType: IChatType
  mobile?: string
  sessionId?: string
}

export interface IChatRepository {
  create(chat: Chat): Promise<void>
}
