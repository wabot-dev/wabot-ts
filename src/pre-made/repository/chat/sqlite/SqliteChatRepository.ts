import { Chat, type IChatConnection, type IChatMemory, type IChatRepository } from '@/core'

import path from 'path'

import { SqliteChatMemory } from './SqliteChatMemory'
import { SqliteCrudRepository, sqliteMapperFor } from '@/repository'

export class SqliteChatRepository extends SqliteCrudRepository<Chat> implements IChatRepository {
  constructor() {
    super('chat', SqliteChatRepository.getDbPath(), sqliteMapperFor(Chat))
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
