import { IChatFunctionCall } from './IChatFunctionCall'
import { IChatMessage } from './IChatMessage'

export type ISystemMessageItem = {
  type: 'SYSTEM_MESSAGE'
  content: IChatMessage
}

export type IUserMessageItem = {
  type: 'USER_MESSAGE'
  userId: string
  content: IChatMessage
}

export type ISystemFunctionCallItem = {
  type: 'SYSTEM_FUNCTION_CALL'
  content: IChatFunctionCall
}

export type IChatItem = {
  id: string
  createdAt: Date
} & (ISystemMessageItem | IUserMessageItem | ISystemFunctionCallItem)

export type IChatItemType = IChatItem['type']
export type IChatItemContent = IChatItem['content']
