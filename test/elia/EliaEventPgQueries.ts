import { pgExtension, PgRepositoryExtension } from '@/feature/pg'
import { EliaEvent } from './EliaEvent'
import { EliaEventRepository } from './EliaEventRepository'
import { IEliaEventPgQueries } from './IEliaEventPgQueries'

@pgExtension(EliaEventRepository)
export class EliaEventPgQueries
  extends PgRepositoryExtension<EliaEvent>
  implements IEliaEventPgQueries
{
  async findUpcoming(fromMillis: number, limit: number): Promise<EliaEvent[]> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE (data->>'dateTime')::bigint >= $1
       ORDER BY (data->>'dateTime')::bigint ASC
       LIMIT $2
    `
    return this.query(sql, [fromMillis, limit])
  }

  async findByUserInRange(
    userId: string,
    fromMillis: number,
    toMillis: number,
  ): Promise<EliaEvent[]> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE data->>'userId' = $1
         AND (data->>'dateTime')::bigint BETWEEN $2 AND $3
       ORDER BY (data->>'dateTime')::bigint ASC
    `
    return this.query(sql, [userId, fromMillis, toMillis])
  }
}
