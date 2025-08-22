import { type IChatMessage, type IConnectionChatMessage } from '../IConnectionChatMessage'
import { Entity, IEntityData } from '../Entity'
import { type IChatFunctionCall } from './IChatFunctionCall'

export type ISystemMessageItem = {
  type: 'BOT_MESSAGE'
  content: IChatMessage
}

export type IReceivedMessageItem = {
  type: 'CONNECTION_MESSAGE'
  content: IConnectionChatMessage
}

export type ISystemFunctionCallItem = {
  type: 'FUNCTION_CALL'
  content: IChatFunctionCall
}

export type IChatItemRawData = ISystemMessageItem | IReceivedMessageItem | ISystemFunctionCallItem
export type IChatItemData = IEntityData & IChatItemRawData
export type IChatItemType = IChatItemData['type']

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
