import { ChatItem, ChatItemRepository, IChatItemQueries } from '@/feature/chat-bot'
import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'

/**
 * In-memory implementation of {@link ChatItemRepository}'s custom queries.
 * Ships with the framework and registers itself on import.
 */
@memExtension(ChatItemRepository)
export class ChatItemMemoryQueries
  extends MemoryRepositoryExtension<ChatItem>
  implements IChatItemQueries
{
  findLastItemsByChatId = async (chatId: string, count: number): Promise<ChatItem[]> => {
    const items = [...this.items.values()].filter((item) => item['data'].chatId === chatId)
    // Insertion order is chronological here, so the tail is the newest window.
    return items.slice(-count).map((item) => this.clone(item))
  }
}
