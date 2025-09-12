import { PgCrudRepository } from '@/feature/pg'
import { ChatItem, IChatMemory } from '@/feature/chat-bot'
import { Pool } from 'pg'

export class PgChatMemory extends PgCrudRepository<ChatItem> implements IChatMemory {
  constructor(
    pool: Pool,
    private chatId: string,
  ) {
    super(pool, {
      table: 'chat_item',
      schema: 'wabot',
      constructor: ChatItem,
      add: {
        columns: {
          chat_id: {
            type: 'TEXT',
            value: () => chatId,
          },
        },
      },
    })
  }

  async findLastItems(count: number): Promise<ChatItem[]> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE chat_id = $1
        ORDER BY created_at DESC
      LIMIT $2
    `
    const items = await this.query(sql, [this.chatId, count])
    return items.reverse()
  }
}
