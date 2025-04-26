import { type IChatMessage, type IConnectionChatMessage } from '../IReceivedMessage'
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

export type IChatItem = {
  id: string
  createdAt: Date
} & (ISystemMessageItem | IReceivedMessageItem | ISystemFunctionCallItem)

export type IChatItemType = IChatItem['type']
