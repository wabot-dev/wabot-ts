import { Chat, type IChatConnection, type IChatMemory, type IChatRepository } from '@/core'
import { singleton } from '@/injection'
import { Pool } from 'pg'
import { PgCrudRepository } from '../PgCrudRepository'
import { PgChatMemory } from './PgChatMemory'

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
    `
    const items = await this.query(sql, [JSON.stringify([query])])
    return items.at(0) ?? null
  }

  async findMemory(chatId: string): Promise<IChatMemory | null> {
    return new PgChatMemory(this.pool, chatId)
  }
}
