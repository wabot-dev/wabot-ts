import { Chat, type IChatConnection, type IChatMemory, type IChatRepository } from '@/core'
import { Pool } from 'pg'
import { PgCrudRepository } from '../PgCrudRepository'
import { pgMapperFor } from '../PgPersistentMapper'
import { singleton } from '@/injection'

@singleton()
export class PgChatRepository extends PgCrudRepository<Chat> implements IChatRepository {
  constructor(pool: Pool) {
    super(pool, 'chat', pgMapperFor(Chat))
  }

  async findByConnection(query: IChatConnection): Promise<Chat | null> {
    const pool = await this.getPool()
    throw new Error('Method not implemented.')
  }

  async findMemory(chatId: string): Promise<IChatMemory | null> {
    const pool = await this.getPool()
    throw new Error('Method not implemented.')
  }
}
