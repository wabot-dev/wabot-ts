import { ChatItem, ChatItemRepository, IChatItemQueries } from '@/feature/chat-bot'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { dbExtension } from '@/feature/repository'

/**
 * Postgres implementation of {@link ChatItemRepository}'s custom queries. Ships
 * with the framework and registers itself on import. Reads through the promoted
 * `chat_id` column, so the conversation lookup is an indexed one.
 */
@dbExtension(ChatItemRepository)
export class ChatItemPgQueries
  extends PgJsonbRepositoryExtension<ChatItem>
  implements IChatItemQueries
{
  findLastItemsByChatId = async (chatId: string, count: number): Promise<ChatItem[]> => {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE chat_id = $1
       ORDER BY created_at DESC
       LIMIT $2
    `
    const items = await this.query(sql, [chatId, count])
    // Newest first on the way out of the database, oldest first for the caller.
    return items.reverse()
  }
}
