import { IChatMemory } from './IChatMemory'

export interface IChatMemoryRepository {
  find(chatId: string): Promise<IChatMemory | null>
}

export class ChatMemoryRepository implements IChatMemoryRepository {
  find(chatId: string): Promise<IChatMemory> {
    throw new Error('Method not implemented.')
  }
}
