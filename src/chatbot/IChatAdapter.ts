import { IChatItemRawData } from '@/core'

export interface IChatToolParameter {
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
  prevItems: IChatItemRawData[]
}

export interface IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatItemRawData>
}
