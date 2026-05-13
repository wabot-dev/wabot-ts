import type { ChatItem, IChatMemory } from '@/feature/chat-bot'

export class InMemoryChatMemory implements IChatMemory {
  private memory: ChatItem[] = []

  async findLastItems(count: number): Promise<ChatItem[]> {
    return this.memory.slice(-count)
  }

  async create(item: ChatItem): Promise<void> {
    this.memory.push(item)
  }

  async clearMemory(): Promise<void> {
    this.memory = []
  }
}
