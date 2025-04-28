import { ChatItem } from '../../ChatItem'
import { type IChatMemory } from '../IChatMemory'

export class RamChatMemory implements IChatMemory {
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
