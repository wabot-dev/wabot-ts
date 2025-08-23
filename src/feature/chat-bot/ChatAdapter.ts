import { IChatAdapter, IChatAdapterNextItemReq } from "./IChatAdapter";
import { IChatItem } from "./IChatItem";

export class ChatAdapter implements IChatAdapter {
  nextItem(req: IChatAdapterNextItemReq): Promise<IChatItem> {
    throw new Error("Method not implemented.");
  }
}