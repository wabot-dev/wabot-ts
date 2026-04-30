import { injectable } from '@/core/injection'
import { Chat, IChatAssociation } from './Chat'
import { ChatItem } from './ChatItem'
import { IChatConnection } from './IChatConnection'
import { IChatMessage } from './IChatMessage'
import { ChatMemory } from './ChatMemory'
import { ChatRepository } from './ChatRepository'

@injectable()
export class ChatOperator {
  constructor(
    private chat: Chat,
    private memory: ChatMemory,
    private repository: ChatRepository,
  ) {}

  async saveHumanMessage(message: IChatMessage): Promise<ChatItem> {
    const item = new ChatItem({ type: 'humanMessage', humanMessage: message })
    await this.memory.create(item)
    return item
  }

  async saveBotMessage(message: IChatMessage): Promise<ChatItem> {
    const item = new ChatItem({ type: 'botMessage', botMessage: message })
    await this.memory.create(item)
    return item
  }

  getConnections(): IChatConnection[] {
    return this.chat.connections
  }

  async addConnection(connection: IChatConnection): Promise<void> {
    this.chat.addConnection(connection)
    await this.repository.update(this.chat)
  }

  async removeConnection(connection: IChatConnection): Promise<void> {
    this.chat.removeConnection(connection)
    await this.repository.update(this.chat)
  }

  hasAssociations(type: string): boolean {
    return this.chat.hasAssociations(type)
  }

  hasAssociation(association: IChatAssociation): boolean {
    return this.chat.hasAssociation(association)
  }

  findAssociations(type?: string): IChatAssociation[] {
    if (type === undefined) return this.chat.associations
    return this.chat.getAssociationsByType(type)
  }

  async addAssociation(association: IChatAssociation): Promise<void> {
    this.chat.addAssociation(association)
    await this.repository.update(this.chat)
  }

  async removeAssociation(association: IChatAssociation): Promise<void> {
    this.chat.removeAssociation(association)
    await this.repository.update(this.chat)
  }
}
