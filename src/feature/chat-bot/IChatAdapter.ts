import { IMindsetTool } from '@/feature/mindset'
import { IChatItem } from './IChatItem'
import { ILanguageModelUsage } from './ILanguageModelUsage'

export interface IChatAdapterNextItemReq {
  model: string
  systemPrompt: string
  tools: IMindsetTool[]
  prevItems: IChatItem[]
}

export interface IChatAdapterNextItemRes {
  chatItem: IChatItem
  usage: ILanguageModelUsage
}


export interface IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes>
}
