import { IChatItem } from '../IChatItem'
import { IChatMemory } from './IChatMemory'

export abstract class ChatMemory implements IChatMemory {
  findLastItems(count: number): Promise<IChatItem[]> {
    throw new Error('Method not implemented.')
  }

  saveItem(item: IChatItem): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
