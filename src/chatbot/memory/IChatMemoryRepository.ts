import { Chat } from '@/chat'
import { IChatMemory } from './IChatMemory'

export interface IChatMemoryRepository {
  create(chat: Chat): Promise<void>
  find(chatId: string): Promise<IChatMemory | null>
}

export class ChatMemoryRepository implements IChatMemoryRepository {
  create(chat: Chat): Promise<void> {
    throw new Error('Method not implemented.')
  }
  find(chatId: string): Promise<IChatMemory | null> {
    throw new Error('Method not implemented.')
  }
}
