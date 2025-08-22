import { Entity, IEntityData } from '../Entity'
import { IChatItem } from './IChatAdapter'

export type IChatItemData = IEntityData & IChatItem

export class ChatItem extends Entity<IChatItemData> {
  getType() {
    return this.data.type
  }

  getContent() {
    return this.data.content
  }

  getData() {
    return this.data
  }
}
