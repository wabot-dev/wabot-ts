import { ChatItem } from './ChatItem'
import { ChatItemRepository } from './ChatItemRepository'
import { IChatMemory } from './IChatMemory'

/**
 * One chat's conversation: a view of {@link ChatItemRepository} bound to a chat
 * id. Obtained from `ChatRepository.findMemory(chatId)` and injected into the
 * bot for the duration of a turn.
 */
export class ChatMemory implements IChatMemory {
  constructor(
    private readonly items: ChatItemRepository,
    private readonly chatId: string,
  ) {}

  /** The last `count` items of this chat, oldest first. */
  findLastItems(count: number): Promise<ChatItem[]> {
    return this.items.findLastItemsByChatId(this.chatId, count)
  }

  async create(item: ChatItem): Promise<void> {
    // Stamping the owner here is what keeps the promoted `chat_id` column and
    // the conversation lookup in agreement.
    item['data'].chatId = this.chatId
    await this.items.create(item)
  }
}
