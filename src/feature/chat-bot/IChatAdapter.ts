import { IMindsetTool } from '@/feature/mindset'
import { IChatItem } from './IChatItem'
import { ILanguageModelUsage } from './ILanguageModelUsage'

export interface IChatAdapterNextItemsReq {
  model: string
  systemPrompt: string
  tools: IMindsetTool[]
  prevItems: IChatItem[]
}

export interface IChatAdapterNextItemsRes {
  nextItems: IChatItem[]
  usage: ILanguageModelUsage
}

export interface IChatAdapter {
  nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes>
}
