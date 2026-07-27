import { ChatItem } from './ChatItem'

/**
 * Custom (non field-equality) queries for `ChatItemRepository`, implemented
 * once per adapter (in-memory + Postgres). Both implementations ship with the
 * framework.
 */
export interface IChatItemQueries {
  /** The chat's last `count` items, oldest first — a conversation window. */
  findLastItemsByChatId(chatId: string, count: number): Promise<ChatItem[]>
}
