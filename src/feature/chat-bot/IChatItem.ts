import { IChatMessage } from './IChatMessage'
import { IFunctionCall } from './IFunctionCall'

export const chatItemTypeOptions = ['botMessage', 'humanMessage', 'functionCall'] as const

export type IBotMessageItem = {
  type: 'botMessage'
  botMessage: IChatMessage
  humanMessage?: undefined
  functionCall?: undefined
}

export type IHumanMessageItem = {
  type: 'humanMessage'
  botMessage?: undefined
  humanMessage: IChatMessage
  functionCall?: undefined
}

export type IFunctionCallItem = {
  type: 'functionCall'
  botMessage?: undefined
  humanMessage?: undefined
  functionCall: IFunctionCall
}

export type IChatItem = IBotMessageItem | IHumanMessageItem | IFunctionCallItem

export type IChatItemType = (typeof chatItemTypeOptions)[number]
