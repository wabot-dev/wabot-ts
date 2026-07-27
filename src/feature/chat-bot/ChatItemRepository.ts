import { CrudRepository } from '@/core/repository'
import { queryExtension, repository } from '@/feature/repository'
import { ChatItem } from './ChatItem'
import { IChatItemQueries } from './IChatItemQueries'

/**
 * Store for the items of every chat, built on the standard repository pattern:
 * in-memory by default, Postgres when a `DATABASE_URL` is configured.
 *
 * `chatId` is promoted to a real `chat_id` column so a conversation is read by
 * an indexed lookup instead of a document scan — the same column the
 * pre-pattern implementation wrote, so existing rows stay readable.
 * {@link ChatMemory} is the per-chat view of this repository.
 */
@repository({
  schema: 'wabot',
  table: 'chat_item',
  constructor: ChatItem,
  add: {
    columns: {
      chat_id: { type: 'TEXT', value: (item: ChatItem) => item['data'].chatId ?? null },
    },
  },
})
export class ChatItemRepository extends CrudRepository<ChatItem, IChatItemQueries> {
  @queryExtension() declare findLastItemsByChatId: (
    chatId: string,
    count: number,
  ) => Promise<ChatItem[]>
}
