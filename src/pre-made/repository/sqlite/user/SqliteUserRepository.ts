import { User, type IUserConnection, type IUserRepository } from '@/core'

import type { IReversibleMapper } from '@/shared'
import path from 'path'
import { SqliteCrudRepository } from '../SqliteCrudRepository'

const userSqliteMapper: IReversibleMapper<User, string> = {
  map(input) {
    return JSON.stringify(input['data'])
  },

  rev(input) {
    const data = JSON.parse(input)
    data.createdAt = new Date(data.createdAt)
    data.discardedAt = data.discardedAt && new Date(data.discardedAt)
    return new User(data)
  },
}

export class SqliteUserRepository extends SqliteCrudRepository<User> implements IUserRepository {
  constructor() {
    super('user', SqliteUserRepository.getDbPath(), userSqliteMapper)
  }

  async findByConnection(query: IUserConnection): Promise<User | null> {
    const allItems = await this.findAll()
    return allItems.find((item) => item.hasConnection(query)) ?? null
  }

  static getDbPath() {
    return path.join(process.cwd(), '.sqlite', 'user.db')
  }
}
