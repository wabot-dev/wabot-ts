import { v4 as uuidv4 } from 'uuid'
import { Chat, IChatConnection } from '../../Chat'
import { IChatRepository } from '../IChatRepository'

export class RamChatRepository implements IChatRepository {
  private items: Chat[] = []

  async create(chat: Chat): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    chat['data'].id = uuidv4()
    chat['data'].createdAt = new Date()

    chat.validate()

    this.items.push(chat)
  }

  async findPrivateChat(query: IChatConnection): Promise<Chat | null> {
    return this.items.find((item) => item.isPrivate() && item.hasConnection(query)) ?? null
  }

  async findGroupChat(query: IChatConnection): Promise<Chat | null> {
    return this.items.find((item) => item.isGroup() && item.hasConnection(query)) ?? null
  }
}
