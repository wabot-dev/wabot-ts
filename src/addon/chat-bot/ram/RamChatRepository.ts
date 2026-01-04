import { v4 as uuidv4 } from 'uuid'

import { RamChatMemory } from './RamChatMemory'
import { singleton } from '@/core/injection'
import type { Chat, IChatConnection, IChatMemory, IChatRepository } from '@/feature/chat-bot'

interface IRamChatMemory {
  chatId: string
  memory: RamChatMemory
}

@singleton()
export class RamChatRepository implements IChatRepository {
  private items: Chat[] = []
  private memories: IRamChatMemory[] = []

  async update(chat: Chat): Promise<void> {
    if (!chat.wasCreated()) {
      throw new Error('Chat wat not created')
    }

    chat.validate()
  }

  async create(chat: Chat): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    chat['data'].id = uuidv4()
    chat['data'].createdAt = new Date().getTime()

    chat.validate()

    this.items.push(chat)
    const memory: IRamChatMemory = {
      memory: new RamChatMemory(),
      chatId: chat.id,
    }
    this.memories.push(memory)
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    return this.items.find((item) => item.hasConnection(query)) ?? null
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    const memory = this.getMemory(chatId)
    if (!memory) {
      return Promise.resolve(null)
    }
    return Promise.resolve(memory.memory)
  }

  private getMemory(chatId: string): IRamChatMemory | null {
    return this.memories.find((r) => r.chatId === chatId) ?? null
  }
}
