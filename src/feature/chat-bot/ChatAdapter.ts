import { IChatAdapter, IChatAdapterNextItemReq, IChatAdapterNextItemRes } from './IChatAdapter'

export class ChatAdapter implements IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatAdapterNextItemRes> {
    throw new Error('Method not implemented.')
  }
}
