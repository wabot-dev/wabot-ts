import { User, type IUserConnection, type IUserRepository } from '@/core'
import { PgCrudRepository } from '@/repository'
import type { Pool } from 'pg'

export class PgUserRepository extends PgCrudRepository<User> implements IUserRepository {
  constructor(pool: Pool) {
    super(pool, {
      table: 'user',
      schema: 'wabot',
      constructor: User,
    })
  }

  async findByConnection(query: IUserConnection): Promise<User | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data->'connections' @> $1::jsonb
      LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify([query])])
    return items.at(0) ?? null
  }
}
