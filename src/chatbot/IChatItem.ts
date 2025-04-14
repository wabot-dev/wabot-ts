import { IChatMessage } from '../message/IChatMessage'
import { IChatFunctionCall } from './IChatFunctionCall'

export type ISystemMessageItem = {
  type: 'BOT_MESSAGE'
  content: IChatMessage
}

export type IUserMessageItem = {
  type: 'USER_MESSAGE'
  userId: string
  content: IChatMessage
}

export type ISystemFunctionCallItem = {
  type: 'FUNCTION_CALL'
  content: IChatFunctionCall
}

export type IChatItem = {
  id: string
  createdAt: Date
} & (ISystemMessageItem | IUserMessageItem | ISystemFunctionCallItem)

export type IChatItemType = IChatItem['type']
