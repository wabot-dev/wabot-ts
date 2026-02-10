import { ChatItem } from './ChatItem'
import { IChatMemory } from './IChatMemory'

export class ChatMemory implements IChatMemory {
  findLastItems(count: number): Promise<ChatItem[]> {
    throw new Error('Method not implemented.')
  }
  create(item: ChatItem): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
