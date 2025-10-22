import { IChatAdapter, IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from './IChatAdapter'

export class ChatAdapter implements IChatAdapter {
  nextItems(req: IChatAdapterNextItemsReq & { provider?: string }): Promise<IChatAdapterNextItemsRes> {
    throw new Error('Method not implemented.')
  }
}
