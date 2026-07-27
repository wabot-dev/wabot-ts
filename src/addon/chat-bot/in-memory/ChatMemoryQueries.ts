import { Chat, ChatRepository, IChatConnection, IChatQueries } from '@/feature/chat-bot'
import { memExtension, MemoryRepositoryExtension } from '@/feature/repository'

/**
 * In-memory implementation of {@link ChatRepository}'s custom queries. Ships
 * with the framework and registers itself on import.
 */
@memExtension(ChatRepository)
export class ChatMemoryQueries extends MemoryRepositoryExtension<Chat> implements IChatQueries {
  findByConnection = async (connection: IChatConnection): Promise<Chat | null> => {
    for (const chat of this.items.values()) {
      if (chat.hasConnection(connection)) return this.clone(chat)
    }
    return null
  }
}
