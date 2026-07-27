import { Chat, ChatRepository, IChatConnection, IChatQueries } from '@/feature/chat-bot'
import { PgJsonbRepositoryExtension } from '@/feature/pg'
import { dbExtension } from '@/feature/repository'

/**
 * Postgres implementation of {@link ChatRepository}'s custom queries. Ships
 * with the framework and registers itself on import. Uses JSONB containment
 * (`@>`) so a GIN index on `data` can serve the lookup.
 */
@dbExtension(ChatRepository)
export class ChatPgQueries extends PgJsonbRepositoryExtension<Chat> implements IChatQueries {
  findByConnection = async (connection: IChatConnection): Promise<Chat | null> => {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data->'connections' @> $1::jsonb
       LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify([connection])])
    return items.at(0) ?? null
  }
}
