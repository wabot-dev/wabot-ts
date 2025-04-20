import { IChatMemory } from '../IChatMemory'
import { RamChatMemory } from './RamChatMemory'
import { IChatMemoryRepository } from '../IChatMemoryRepository'
import { singleton } from '@/injection'

interface IRamChatRegistry {
  chatId: string
  memory: RamChatMemory
}

@singleton()
export class RamChatMemoryRepository implements IChatMemoryRepository {
  private registries: IRamChatRegistry[] = []

  find(chatId: string): Promise<IChatMemory | null> {
    const registry = this.getRegistry(chatId)
    if (!registry) {
      return Promise.resolve(null)
    }
    return Promise.resolve(registry.memory)
  }

  private getRegistry(chatId: string): IRamChatRegistry {
    return this.registries.find((r) => r.chatId === chatId) || this.createRegistry(chatId)
  }

  private createRegistry(chatId: string): IRamChatRegistry {
    const registry: IRamChatRegistry = {
      memory: new RamChatMemory(),
      chatId,
    }
    this.registries.push(registry)
    return registry
  }
}
