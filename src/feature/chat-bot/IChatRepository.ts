import { type Chat } from './Chat'
import { type IChatMemory } from './IChatMemory'
import { IChatConnection } from './IChatConnection'

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  update(chat: Chat): Promise<void>
  findByConnection(query: IChatConnection): Promise<Chat | null>
  findMemory(chatId: string): Promise<IChatMemory | null>
}
