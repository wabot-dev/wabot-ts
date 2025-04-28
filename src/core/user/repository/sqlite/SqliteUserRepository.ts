import { SqliteCrudRepository } from '@/pre-made/repository/sqlite/SqliteCrudRepository'
import type { IUserConnection, User } from '../../User'
import type { IUserRepository } from '../IUserRepository'

export class SqliteUserRepository extends SqliteCrudRepository<User> implements IUserRepository {
  async findByConnection(query: IUserConnection): Promise<User | null> {
    const allItems = await this.findAll()
    return allItems.find((item) => item.hasConnection(query)) ?? null
  }
}
