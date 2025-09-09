import { IChatAdapter, IChatAdapterNextItemReq, IChatAdapterNextItemRes } from './IChatAdapter'

export class ChatAdapter implements IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq & { provider?: string }): Promise<IChatAdapterNextItemRes> {
    throw new Error('Method not implemented.')
  }
}
