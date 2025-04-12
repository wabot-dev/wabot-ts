import { IChatItem } from '../content'

export interface IChatMemory {
  findLastItems(count: number): Promise<IChatItem[]>
  saveItem(item: IChatItem): Promise<void>
}
