import { Chat } from './Chat'
import { IChatConnection } from './IChatConnection'
import { IChatMemory } from './IChatMemory'
import { IChatRepository } from './IChatRepository'

export class ChatRepository implements IChatRepository {
  create(chat: Chat): Promise<void> {
    throw new Error('Method not implemented.')
  }

  update(chat: Chat): Promise<void> {
    throw new Error('Method not implemented.')
  }

  findByConnection(query: IChatConnection): Promise<Chat | null> {
    throw new Error('Method not implemented.')
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    throw new Error('Method not implemented.')
  }
}
