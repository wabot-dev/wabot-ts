import { singleton } from '@/injection'
import { Chat, IChatConnection } from '../Chat'
import { IChatMemory } from './IChatMemory'

export interface IChatRepository {
  create(chat: Chat): Promise<void>
  findByConnection(query: IChatConnection): Promise<Chat | null>
  findMemory(chatId: string): Promise<IChatMemory | null>
}

@singleton()
export class ChatRepository implements IChatRepository {
  create(chat: Chat): Promise<void> {
    throw new Error('Method not implemented.')
  }

  findByConnection(query: IChatConnection): Promise<Chat | null> {
    throw new Error('Method not implemented.')
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    throw new Error('Method not implemented.')
  }
}
