import path from 'path'
import { Chat, type IChatConnection } from '../../Chat'
import type { IChatMemory } from '../IChatMemory'
import type { IChatRepository } from '../IChatRepository'

import { open } from 'sqlite'
import sqlite3 from 'sqlite3-offline-next'

export class SqliteChatRepository implements IChatRepository {
  constructor() {
    this.createTable()
  }

  async create(chat: Chat): Promise<void> {
    const db = await this.getDb()
    await db.run('INSERT INTO chat VALUES (?, ?)', [chat['data'].id, chat['data']])
    db.close()
  }

  async find(chatId: string): Promise<Chat | null> {
    const db = await this.getDb()
    const result = await db.all('SELECT * FROM chat WHERE id = ?', [chatId])
    db.close()

    const foundItem = result.at(0)
    if (!foundItem) {
      db.close()
      return null
    }

    const data = JSON.parse(foundItem.data)
    const chat = new Chat(data)

    return chat
  }

  async findByConnection(connection: IChatConnection): Promise<Chat | null> {
    const db = await this.getDb()
    const result = await db.all('SELECT * FROM chat')
    db.close()

    for (const item of result) {
      const data = JSON.parse(item.data)
      const chat = new Chat(data)
      if (chat.hasConnection(connection)) {
        return chat
      }
    }

    return null
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    throw new Error('Method not implemented.')
  }

  private async getDb() {
    const db = await open({
      filename: this.getDbPath(),
      driver: sqlite3.Database,
    })
    return db
  }

  private getDbPath() {
    return path.join(process.cwd(), '.sqlite', 'chat.db')
  }

  private async createTable() {
    const db = await this.getDb()
    await db.exec('CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, data TEXT)')
    db.close()
  }
}
