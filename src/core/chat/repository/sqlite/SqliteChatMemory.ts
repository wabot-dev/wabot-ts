import path from 'path'
import { ChatItem } from '../../ChatItem'
import type { IChatMemory } from '../IChatMemory'

import { SqliteCrudRepository } from '@/pre-made/repository/sqlite/SqliteCrudRepository'
import type { IReversibleMapper } from '@/shared'

const chatItemSqliteMapper: IReversibleMapper<ChatItem, string> = {
  map(input) {
    return JSON.stringify(input['data'])
  },

  rev(input) {
    const data = JSON.parse(input)
    data.createdAt = new Date(data.createdAt)
    data.discardedAt = data.discardedAt && new Date(data.discardedAt)
    return new ChatItem(data)
  },
}

export class SqliteChatMemory extends SqliteCrudRepository<ChatItem> implements IChatMemory {
  constructor(private chatId: string) {
    super('chat_item', SqliteChatMemory.getDbPath(chatId), chatItemSqliteMapper)
    this.createTable()
  }

  async findLastItems(count: number): Promise<ChatItem[]> {
    const allItems = await this.findAll()
    return allItems.slice(allItems.length - count, allItems.length)
  }

  static getDbPath(chatId: string) {
    return path.join(process.cwd(), '.sqlite', 'chat-memory', chatId + '.db')
  }
}
