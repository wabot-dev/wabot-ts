import { Chat, type IChatConnection, type IChatMemory, type IChatRepository } from '@/core'
import { singleton } from '@/injection'
import { Pool } from 'pg'
import { PgCrudRepository } from '../PgCrudRepository'
import { pgMapperFor } from '../PgPersistentMapper'
import { PgChatMemory } from './PgChatMemory'

@singleton()
export class PgChatRepository extends PgCrudRepository<Chat> implements IChatRepository {
  constructor(pool: Pool) {
    super(pool, 'chat', pgMapperFor(Chat))
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    const conn = await this.connect()
    const sql = `
      SELECT id, data 
      FROM ${this.tableName} 
      WHERE data->'connections' @> $1::jsonb
    `
    const { rows } = await conn.query(sql, [JSON.stringify([query])])
    if (!rows.length) return null
    return this.mapper.rev(rows[0])
  }

  async findMemory(chatId: string): Promise<IChatMemory | null> {
    return new PgChatMemory(this.pool, chatId)
  }
}
