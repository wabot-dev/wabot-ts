import { IChatItem } from '../IChatItem'

export interface IChatMemory {
  findLastItems(count: number): Promise<IChatItem[]>
  saveItem(item: IChatItem): Promise<void>
}

export class ChatMemory implements IChatMemory {
  findLastItems(count: number): Promise<IChatItem[]> {
    throw new Error('Method not implemented.')
  }
  saveItem(item: IChatItem): Promise<void> {
    throw new Error('Method not implemented.')
  }
}