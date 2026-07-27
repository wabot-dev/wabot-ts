import { Entity, IEntityData } from '@/core/entity'
import { IChatItem } from './IChatItem'
import { IChatMessage } from './IChatMessage'
import { IFunctionCall } from './IFunctionCall'

/** The chat this item belongs to; promoted to a column by `ChatItemRepository`. */
export type IChatItemOwner = { chatId?: string }

export type IChatItemData = IEntityData & IChatItem & IChatItemOwner

export class ChatItem extends Entity<IChatItemData> {
  get type() {
    return this.data.type
  }

  get botMessage() {
    return this.data.botMessage as IChatMessage
  }

  get functionCall() {
    return this.data.functionCall as IFunctionCall
  }

  setFunctionResult(result: string) {
    if (this.data.type !== 'functionCall') {
      throw new Error('The chat item is not functionCall type')
    }
    this.data.functionCall.result = result
  }

  getData() {
    return this.data
  }
}
