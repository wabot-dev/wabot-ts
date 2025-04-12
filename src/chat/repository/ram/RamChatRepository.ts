import { Chat } from '../../model'
import { IChatMemory } from '../IChatMemory'
import { IChatQuery, IChatRepository } from '../IChatRepository'
import { RamChatMemory } from './RamChatMemory'
import { v4 as uuidv4 } from 'uuid'

interface IRamChatRegistry {
  mobile: string | null
  sessionId: string | null
  chat: Chat
  memory: RamChatMemory
}

export class RamChatRepository implements IChatRepository {
  private registries: IRamChatRegistry[] = []

  async create(chat: Chat): Promise<void> {
    if(chat.wasCreated()) {
      throw new Error('Chat already created')
    }
    
    chat['data'].createdAt = new Date()
    chat['data'].id = uuidv4()
    chat.validate()

    const registry: IRamChatRegistry = {
      mobile: chat.getMobile(),
      sessionId: chat.getSessionId(),
      memory: new RamChatMemory(),
      chat,
    }
    this.registries.push(registry)
  }

  findMemory(query: IChatQuery): Promise<IChatMemory | null> {
    const registry = this.getRegistry(query)
    if (!registry) {
      return Promise.resolve(null)
    }
    return Promise.resolve(registry.memory)
  }

  private getRegistry(query: IChatQuery): IRamChatRegistry | null {
    if (query.chatType === 'SINGLE_PERSON') {
      if (query.mobile) {
        return this.getByMobile(query.mobile)
      }
      if (query.sessionId) {
        return this.getBySessionId(query.sessionId)
      }
      throw new Error(
        'Either mobile or sessionId must be provided for SINGLE_PERSON chat type',
      )
    }
    throw new Error(`Unsupported chat type: ${query.chatType}`)
  }

  private getByMobile(mobile: string): IRamChatRegistry | null {
    return this.registries.find((r) => r.mobile === mobile)
  }

  private getBySessionId(sessionId: string): IRamChatRegistry | null {
    return this.registries.find((r) => r.sessionId === sessionId)
  }
}
