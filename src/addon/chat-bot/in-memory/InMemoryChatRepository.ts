import * as fs from 'node:fs'
import * as path from 'node:path'
import { v4 as uuidv4 } from 'uuid'

import { InMemoryChatMemory } from './InMemoryChatMemory'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import {
  Chat,
  ChatOperator,
  type IChatConnection,
  type IChatData,
  type IChatMemory,
  type IChatRepository,
} from '@/feature/chat-bot'

interface IRamChatMemory {
  chatId: string
  memory: InMemoryChatMemory
}

const CHATS_FILE = '.wabot/in-memory/chats.json'
const MEMORY_DIR = '.wabot/in-memory'
const MAX_CHATS = 32

const logger = new Logger('wabot:in-memory-chat-repository')

@singleton()
export class InMemoryChatRepository implements IChatRepository {
  // Ordered least-recently-active first, most-recent last.
  private items: Chat[] = []
  private memories: IRamChatMemory[] = []

  constructor() {
    this.load()
  }

  async update(chat: Chat): Promise<void> {
    if (!chat.wasCreated()) {
      throw new Error('Chat wat not created')
    }

    chat.validate()
    this.persist()
  }

  async create(chat: Chat): Promise<void> {
    if (chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    chat['data'].id = uuidv4()
    chat['data'].createdAt = new Date().getTime()

    chat.validate()

    this.items.push(chat)
    this.memories.push({
      chatId: chat.id,
      memory: new InMemoryChatMemory(chat.id, () => this.touch(chat.id)),
    })
    this.enforceLimit()
    this.persist()
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    return this.items.find((item) => item.hasConnection(query)) ?? null
  }

  findMemory(chatId: string): Promise<IChatMemory | null> {
    const memory = this.getMemory(chatId)
    if (!memory) {
      return Promise.resolve(null)
    }
    return Promise.resolve(memory.memory)
  }

  async findOperator(chatId: string): Promise<ChatOperator | null> {
    const chat = this.items.find((item) => item.id === chatId) ?? null
    if (!chat) return null
    const memory = this.getMemory(chatId)
    if (!memory) return null
    return new ChatOperator(chat, memory.memory, this)
  }

  private getMemory(chatId: string): IRamChatMemory | null {
    return this.memories.find((r) => r.chatId === chatId) ?? null
  }

  private touch(chatId: string): void {
    const idx = this.items.findIndex((c) => c.id === chatId)
    if (idx === -1 || idx === this.items.length - 1) {
      if (idx !== -1) this.persist()
      return
    }
    const [chat] = this.items.splice(idx, 1)
    this.items.push(chat)
    this.persist()
  }

  private enforceLimit(): void {
    while (this.items.length > MAX_CHATS) {
      const evicted = this.items.shift()!
      const memIdx = this.memories.findIndex((m) => m.chatId === evicted.id)
      if (memIdx !== -1) this.memories.splice(memIdx, 1)
      this.deleteMemoryFile(evicted.id)
    }
  }

  private deleteMemoryFile(chatId: string): void {
    const file = path.resolve(process.cwd(), MEMORY_DIR, `${chatId}.json`)
    if (!fs.existsSync(file)) return
    try {
      fs.unlinkSync(file)
    } catch (err) {
      logger.warn(`Failed to delete ${file}:`, err)
    }
  }

  private chatsFilePath(): string {
    return path.resolve(process.cwd(), CHATS_FILE)
  }

  private load(): void {
    const file = this.chatsFilePath()
    if (!fs.existsSync(file)) return
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as IChatData[]
      if (!Array.isArray(parsed)) return
      for (const data of parsed) {
        if (!data?.id) continue
        const chat = new Chat(data)
        this.items.push(chat)
        this.memories.push({
          chatId: chat.id,
          memory: new InMemoryChatMemory(chat.id, () => this.touch(chat.id)),
        })
      }
      this.enforceLimit()
    } catch (err) {
      logger.warn(`Failed to load ${file}:`, err)
    }
  }

  private persist(): void {
    const file = this.chatsFilePath()
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const data = this.items.map((c) => c['data'] as IChatData)
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      logger.warn(`Failed to persist ${file}:`, err)
    }
  }
}
