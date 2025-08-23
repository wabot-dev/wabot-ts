import { IChatMessage } from "./IChatMessage"
import { IFunctionCall } from "./IFunctionCall"

export const chatItemTypeOptions = ['botMessage', 'humanMessage', 'functionCall'] as const

export type IBotMessageItem = {
  type: 'botMessage'
  botMessage: IChatMessage
}

export type IHumanMessageItem = {
  type: 'humanMessage'
  humanMessage: IChatMessage
}

export type IFunctionCallItem = {
  type: 'functionCall'
  functionCall: IFunctionCall
}

export type IChatItem = IBotMessageItem | IHumanMessageItem | IFunctionCallItem

export type IChatItemType = (typeof chatItemTypeOptions)[number]