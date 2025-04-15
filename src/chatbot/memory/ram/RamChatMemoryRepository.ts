import { Chat } from '@/chat'
import { IChatMemory } from '../IChatMemory'
import { RamChatMemory } from './RamChatMemory'
import { IChatMemoryRepository } from '../IChatMemoryRepository'

interface IRamChatRegistry {
  chatId: string
  memory: RamChatMemory
}

export class RamChatMemoryRepository implements IChatMemoryRepository {
  private registries: IRamChatRegistry[] = []

  async create(chat: Chat): Promise<void> {
    if (!chat.wasCreated()) {
      throw new Error('Chat was not created')
    }

    const registry: IRamChatRegistry = {
      memory: new RamChatMemory(),
      chatId: chat.getId(),
    }
    this.registries.push(registry)
  }

  find(chatId: string): Promise<IChatMemory | null> {
    const registry = this.getRegistry(chatId)
    if (!registry) {
      return Promise.resolve(null)
    }
    return Promise.resolve(registry.memory)
  }

  private getRegistry(chatId: string): IRamChatRegistry | null {
    return this.registries.find((r) => r.chatId === chatId) || null
  }
}
