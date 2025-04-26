import { Chat, type IChatConnection } from '../../Chat'
import type { IChatMemory } from '../IChatMemory'
import type { IChatRepository } from '../IChatRepository'

import path from 'path'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3-offline-next'

export class SqliteChatRepository implements IChatRepository {
  constructor() {
    this.createChatTable()
  }

  async create(chat: Chat): Promise<void> {
    const db = await this.getDb()
    await db.run('INSERT INTO chat VALUES (?, ?)', [chat['data'].id, JSON.stringify(chat['data'])])
    db.close()
  }

  async find(id: string): Promise<Chat | null> {
    const db = await this.getDb()
    const result = await db.all('SELECT * FROM chat WHERE id=?', [id])
    db.close()

    if (result.length < 1) {
      return null
    }

    const data = JSON.parse(result[0].data)
    data.createdAt = new Date()
    const chat = new Chat(data)
    return chat
  }

  async findAll(): Promise<Chat[]> {
    const db = await this.getDb()
    const result = await db.all('SELECT * FROM chat')
    db.close()

    const chats = result.map((item) => {
      const data = JSON.parse(item.data)
      data.createdAt = new Date()
      const chat = new Chat(data)
      return chat
    })

    return chats
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    const allChats = await this.findAll()
    return allChats.find((chat) => chat.hasConnection(query)) ?? null
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    throw new Error('Method not implemented.')
  }

  private async createChatTable() {
    const db = await this.getDb()
    await db.exec('CREATE TABLE IF NOT EXISTS chat(id TEXT, data TEXT)')
    db.close()
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
}
