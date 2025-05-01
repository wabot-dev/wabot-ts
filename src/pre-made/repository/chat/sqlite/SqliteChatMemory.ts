import path from 'path'

import { ChatItem, type IChatMemory } from '@/core'
import { SqliteCrudRepository, sqliteMapperFor } from '@/repository'

export class SqliteChatMemory extends SqliteCrudRepository<ChatItem> implements IChatMemory {
  constructor(chatId: string) {
    super('chat_item', SqliteChatMemory.getDbPath(chatId), sqliteMapperFor(ChatItem))
  }

  async findLastItems(count: number): Promise<ChatItem[]> {
    const allItems = await this.findAll()
    return allItems.slice(allItems.length - count, allItems.length)
  }

  static getDbPath(chatId: string) {
    return path.join(process.cwd(), '.sqlite', 'chat-memory', chatId + '.db')
  }
}
