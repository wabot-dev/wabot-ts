import { IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from './IChatAdapter'

export class ChatAdapter implements IChatAdapter {
  nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    throw new Error('Method not implemented.')
  }
}
