import { v4 as uuidv4 } from 'uuid'
import { Chat, IChatConnection } from '../../Chat'
import { IChatRepository } from '../IChatRepository'
import { IChatMemory } from '../IChatMemory'
import { RamChatMemory } from './RamChatMemory'
import { singleton } from '@/injection'

interface IRamChatMemory {
  chatId: string
  memory: RamChatMemory
}

@singleton()
export class RamChatRepository implements IChatRepository {
  private items: Chat[] = []
  private memories: IRamChatMemory[] = []

  async create(chat: Chat): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    chat['data'].id = uuidv4()
    chat['data'].createdAt = new Date()

    chat.validate()

    this.items.push(chat)
    const memory: IRamChatMemory = {
      memory: new RamChatMemory(),
      chatId: chat.getId(),
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
