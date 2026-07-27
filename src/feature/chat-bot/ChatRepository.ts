import { injectable } from '@/core/injection'
import { CrudRepository } from '@/core/repository'
import { queryExtension, repository } from '@/feature/repository'
import { Chat } from './Chat'
import { ChatItemRepository } from './ChatItemRepository'
import { ChatMemory } from './ChatMemory'
import { ChatOperator } from './ChatOperator'
import { IChatConnection } from './IChatConnection'
import { IChatQueries } from './IChatQueries'
import { IChatRepository } from './IChatRepository'

/**
 * Chat store built on the standard repository pattern, so it works with any
 * registered adapter out of the box: in-memory by default, Postgres when a
 * `DATABASE_URL` is configured (the runner selects the adapter).
 *
 * CRUD comes from the pattern; `findByConnection` matches inside the chat's
 * connection list, which the method-name grammar cannot express, so it
 * delegates to a per-adapter extension. `findMemory` / `findOperator` are not
 * queries at all — they hand back the per-chat view of
 * {@link ChatItemRepository}.
 */
@injectable()
@repository({ schema: 'wabot', table: 'chat', constructor: Chat })
export class ChatRepository extends CrudRepository<Chat, IChatQueries> implements IChatRepository {
  constructor(private readonly items: ChatItemRepository) {
    super()
  }

  @queryExtension() declare findByConnection: (connection: IChatConnection) => Promise<Chat | null>

  async findMemory(chatId: string): Promise<ChatMemory | null> {
    return new ChatMemory(this.items, chatId)
  }

  async findOperator(chatId: string): Promise<ChatOperator | null> {
    const chat = await this.find(chatId)
    if (!chat) return null
    return new ChatOperator(chat, new ChatMemory(this.items, chatId), this)
  }
}
