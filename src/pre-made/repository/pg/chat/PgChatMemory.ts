import { ChatItem, type IChatMemory } from '@/core'
import { PgCrudRepository } from '../PgCrudRepository'
import { Pool } from 'pg'
import { pgMapperFor } from '../PgPersistentMapper'

export class PgChatMemory extends PgCrudRepository<ChatItem> implements IChatMemory {
  constructor(
    pool: Pool,
    private chatId: string,
  ) {
    super(pool, 'chat_memory', pgMapperFor(ChatItem))
  }

  async findLastItems(count: number): Promise<ChatItem[]> {
    const conn = await this.connect()

    const query = `
      SELECT id, data
      FROM ${this.tableName}
      WHERE chat_id = $1
        ORDER BY created_at DESC
      LIMIT $2
    `
    const { rows } = await conn.query(query, [this.chatId, count])
    return rows.map((row) => this.mapper.rev(row)).reverse()
  }

  override additionalColumns() {
    return {
      chat_id: 'TEXT',
      created_at: 'TIMESTAMP',
    }
  }

  override additionalValues(item: ChatItem) {
    return {
      chat_id: this.chatId,
      created_at: item.getCreatedAt(),
    }
  }
}
