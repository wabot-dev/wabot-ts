import { Chat, type IChatConnection } from '../../Chat'
import type { IChatMemory } from '../IChatMemory'
import type { IChatRepository } from '../IChatRepository'

import { SqliteCrudRepository } from '@/pre-made'
import type { IReversibleMapper } from '@/shared'
import path from 'path'
import { SqliteChatMemory } from './SqliteChatMemory'

const chatSqliteMapper: IReversibleMapper<Chat, string> = {
  map(input) {
    return JSON.stringify(input['data'])
  },

  rev(input) {
    const data = JSON.parse(input)
    data.createdAt = new Date(data.createdAt)
    data.discardedAt = data.discardedAt && new Date(data.discardedAt)
    return new Chat(data)
  },
}

export class SqliteChatRepository extends SqliteCrudRepository<Chat> implements IChatRepository {
  constructor() {
    super('chat', SqliteChatRepository.getDbPath(), chatSqliteMapper)
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    const allChats = await this.findAll()
    return allChats.find((chat) => chat.hasConnection(query)) ?? null
  }

  async findMemory(chatId: string): Promise<IChatMemory | null> {
    const chat = await this.find(chatId)
    if (!chat) return null
    return new SqliteChatMemory(chatId)
  }

  static getDbPath() {
    return path.join(process.cwd(), '.sqlite', 'chat.db')
  }
}
