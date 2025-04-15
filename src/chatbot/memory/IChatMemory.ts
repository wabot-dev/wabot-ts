import { IChatItem } from '../IChatItem'

export interface IChatMemory {
  findLastItems(count: number): Promise<IChatItem[]>
  saveItem(item: IChatItem): Promise<void>
}
