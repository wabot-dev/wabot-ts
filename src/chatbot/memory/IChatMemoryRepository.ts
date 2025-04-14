
import { Chat } from "@/chat";
import { IChatMemory } from "./IChatMemory";

export interface IChatMemoryRepository {
  create(chat: Chat): Promise<void>
  find(chatId: string): Promise<IChatMemory | null>
}