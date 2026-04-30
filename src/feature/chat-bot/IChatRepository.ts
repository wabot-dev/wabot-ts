import { type Chat } from './Chat'
import { type ChatOperator } from './ChatOperator'
import { type IChatMemory } from './IChatMemory'
import { IChatConnection } from './IChatConnection'

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  update(chat: Chat): Promise<void>
  findByConnection(query: IChatConnection): Promise<Chat | null>
  findMemory(chatId: string): Promise<IChatMemory | null>
  findOperator(chatId: string): Promise<ChatOperator | null>
}
