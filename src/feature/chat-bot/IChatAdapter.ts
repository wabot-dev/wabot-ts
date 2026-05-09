import { IMindsetModelRef, IMindsetTool } from '@/feature/mindset'
import { IChatItem } from './IChatItem'
import { ILanguageModelUsage } from './ILanguageModelUsage'

export interface IChatAdapterNextItemsReq {
  models: IMindsetModelRef[]
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
