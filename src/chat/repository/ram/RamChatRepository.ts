import { Chat } from '@/chat/Chat'
import { IChatRepository, IGroupChatQuery, IPrivateChatQuery } from '../IChatRepository'
import { v4 as uuidv4 } from 'uuid'

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

  async findPrivateChat(query: IPrivateChatQuery): Promise<Chat | null> {
    let chat: Chat | null = null
    if (!chat && query.email) {
      chat = this.items.find((item) => item.getEmail() === query.email) ?? null
    }
    if (!chat && query.phone) {
      chat = this.items.find((item) => item.getPhone() === query.phone) ?? null
    }
    return chat
  }

  async findGroupChat(query: IGroupChatQuery): Promise<Chat | null> {
    let chat: Chat | null = null
    chat =
      this.items.find((item) => {
        const group = item.getGroup()
        return group && group.channelType === query.channelType && group.id == query.id
      }) ?? null
    return chat
  }
}
