import * as fs from 'node:fs'
import * as path from 'node:path'

import { Logger } from '@/core/logger'
import { ChatItem, type IChatItemData, type IChatMemory } from '@/feature/chat-bot'

const PERSIST_LIMIT = 32
const PERSIST_DIR = '.wabot/in-memory'

const logger = new Logger('wabot:in-memory-chat-memory')

export class InMemoryChatMemory implements IChatMemory {
  private memory: ChatItem[] = []
  private readonly filePath: string | null
  private readonly onActivity: (() => void) | null

  constructor(chatId?: string, onActivity?: () => void) {
    this.filePath = chatId ? path.resolve(process.cwd(), PERSIST_DIR, `${chatId}.json`) : null
    this.onActivity = onActivity ?? null
    this.load()
  }

  async findLastItems(count: number): Promise<ChatItem[]> {
    return this.memory.slice(-count)
  }

  async create(item: ChatItem): Promise<void> {
    this.memory.push(item)
    if (this.memory.length > PERSIST_LIMIT) {
      this.memory = this.memory.slice(-PERSIST_LIMIT)
    }
    this.persist()
    this.onActivity?.()
  }

  async clearMemory(): Promise<void> {
    this.memory = []
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath)
      } catch (err) {
        logger.warn(`Failed to delete ${this.filePath}:`, err)
      }
    }
  }

  private load(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) return
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Array<{ data: IChatItemData }>
      if (Array.isArray(parsed)) {
        this.memory = parsed.slice(-PERSIST_LIMIT).map((entry) => new ChatItem(entry.data))
      }
    } catch (err) {
      logger.warn(`Failed to load ${this.filePath}:`, err)
    }
  }

  private persist(): void {
    if (!this.filePath) return
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf-8')
    } catch (err) {
      logger.warn(`Failed to persist ${this.filePath}:`, err)
    }
  }
}
