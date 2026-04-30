import { Pool } from 'pg'

import { PgChatMemory } from './PgChatMemory'
import { singleton } from '@/core/injection'
import { PgCrudRepository } from '@/feature/pg'
import {
  Chat,
  ChatOperator,
  IChatConnection,
  IChatMemory,
  IChatRepository,
} from '@/feature/chat-bot'

@singleton()
export class PgChatRepository extends PgCrudRepository<Chat> implements IChatRepository {
  constructor(pool: Pool) {
    super(pool, {
      table: 'chat',
      schema: 'wabot',
      constructor: Chat,
    })
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data->'connections' @> $1::jsonb
      LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify([query])])
    return items.at(0) ?? null
  }

  async findMemory(chatId: string): Promise<IChatMemory | null> {
    return new PgChatMemory(this.pool, chatId)
  }

  async findOperator(chatId: string): Promise<ChatOperator | null> {
    const chat = await this.find(chatId)
    if (!chat) return null
    const memory = new PgChatMemory(this.pool, chatId)
    return new ChatOperator(chat, memory, this)
  }
}
