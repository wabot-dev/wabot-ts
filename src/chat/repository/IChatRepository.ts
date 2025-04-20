import { Chat, IChatConnection } from '../Chat'

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  findPrivateChat(query: IChatConnection): Promise<Chat | null>
  findGroupChat(query: IChatConnection): Promise<Chat | null>
}

export class ChatRepository implements IChatRepository {
  create(chat: Chat): Promise<void> {
    throw new Error('Method not implemented.')
  }
  findPrivateChat(query: IChatConnection): Promise<Chat | null> {
    throw new Error('Method not implemented.')
  }
  findGroupChat(query: IChatConnection): Promise<Chat | null> {
    throw new Error('Method not implemented.')
  }
}