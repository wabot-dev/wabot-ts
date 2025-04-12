import { Chat, IChatType } from "../model";
import { IChatMemory } from "./IChatMemory";

export interface IChatQuery {
  chatType: IChatType
  mobile?: string
  sessionId?: string
}

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  findMemory(query: IChatQuery): Promise<IChatMemory | null>
}