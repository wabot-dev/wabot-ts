import { randomUUID } from 'node:crypto'

import {
  Chat,
  ChatItem,
  ChatOperator,
  IChatConnection,
  IChatItemData,
  IChatMemory,
  IChatRepository,
} from '@/feature/chat-bot'

/**
 * Pure in-RAM chat memory for tests. Unlike the in-memory addon, it never
 * touches the filesystem and exposes the full item list for assertions.
 */
export class TestChatMemory implements IChatMemory {
  private items: ChatItem[] = []

  async findLastItems(count: number): Promise<ChatItem[]> {
    return this.items.slice(-count)
  }

  async create(item: ChatItem): Promise<void> {
    if (!item.wasCreated()) {
      item['data'].id = randomUUID()
      item['data'].createdAt = Date.now()
    }
    this.items.push(item)
  }

  all(): ChatItem[] {
    return [...this.items]
  }

  allData(): IChatItemData[] {
    return this.items.map((item) => item.getData())
  }

  clear(): void {
    this.items = []
  }
}

/** Pure in-RAM chat repository for tests (no `.wabot/` persistence). */
export class TestChatRepository implements IChatRepository {
  private chats: Chat[] = []
  private memories = new Map<string, TestChatMemory>()

  async create(chat: Chat): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    chat['data'].id = randomUUID()
    chat['data'].createdAt = Date.now()
    chat.validate()
    this.chats.push(chat)
    this.memories.set(chat.id, new TestChatMemory())
  }

  async update(chat: Chat): Promise<void> {
    if (!chat.wasCreated()) {
      throw new Error('Chat was not created')
    }
    chat.validate()
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    return this.chats.find((chat) => chat.hasConnection(query)) ?? null
  }

  async findMemory(chatId: string): Promise<TestChatMemory | null> {
    return this.memories.get(chatId) ?? null
  }

  async findOperator(chatId: string): Promise<ChatOperator | null> {
    const chat = this.chats.find((item) => item.id === chatId) ?? null
    const memory = this.memories.get(chatId)
    if (!chat || !memory) return null
    return new ChatOperator(chat, memory, this)
  }
}
