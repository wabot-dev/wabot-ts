import { ChatItem } from '../ChatItem'

export interface IChatMemory {
  findLastItems(count: number): Promise<ChatItem[]>
  create(item: ChatItem): Promise<void>
}

export class ChatMemory implements IChatMemory {
  findLastItems(count: number): Promise<ChatItem[]> {
    throw new Error('Method not implemented.')
  }
  create(item: ChatItem): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
