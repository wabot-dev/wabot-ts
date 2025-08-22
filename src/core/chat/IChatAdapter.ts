export interface IChatMessage {
  text?: string
}

export interface IFunctionCall {
  id: string
  name: string
  arguments?: string
  result?: string
}

export const chatItemTypeOptions = ['botMessage', 'connectionMessage', 'functionCall'] as const

export type IBotMessageItem = {
  type: 'botMessage'
  botMessage: IChatMessage
}

export type IConnectionMessageItem = {
  type: 'connectionMessage'
  connectionMessage: IChatMessage
}

export type IFunctionCallItem = {
  type: 'functionCall'
  functionCall: IFunctionCall
}

export type IChatItem = IBotMessageItem | IConnectionMessageItem | IFunctionCallItem

export type IChatItemType = (typeof chatItemTypeOptions)[number]

export interface IChatToolParameter {
  type: string
  name: string
  description: string
}

export interface IChatTool {
  language: string
  name: string
  description: string
  parameters: IChatToolParameter[]
}

export interface IChatAdapterNextItemReq {
  model: string
  systemPrompt: string
  tools: IChatTool[]
  prevItems: IChatItem[]
}

export interface IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem>
}
