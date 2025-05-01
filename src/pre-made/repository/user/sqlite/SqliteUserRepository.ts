import { User, type IUserConnection, type IUserRepository } from '@/core'
import { SqliteCrudRepository, sqliteMapperFor } from '@/repository'

import path from 'path'

export class SqliteUserRepository extends SqliteCrudRepository<User> implements IUserRepository {
  constructor() {
    super('user', SqliteUserRepository.getDbPath(), sqliteMapperFor(User))
  }

  async findByConnection(query: IUserConnection): Promise<User | null> {
    const allItems = await this.findAll()
    return allItems.find((item) => item.hasConnection(query)) ?? null
  }

  static getDbPath() {
    return path.join(process.cwd(), '.sqlite', 'user.db')
  }
}
