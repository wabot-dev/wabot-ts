import { ChatItem } from './ChatItem'

export interface IChatMemory {
  findLastItems(count: number): Promise<ChatItem[]>
  create(item: ChatItem): Promise<void>
}
