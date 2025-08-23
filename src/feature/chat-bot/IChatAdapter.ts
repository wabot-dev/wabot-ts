import { IMindsetTool } from '@/feature/mindset'
import { IChatItem } from './IChatItem'

export interface IChatAdapterNextItemReq {
  model: string
  systemPrompt: string
  tools: IMindsetTool[]
  prevItems: IChatItem[]
}

export interface IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem>
}
