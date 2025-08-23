import { Pool } from 'pg'
import { WhatsApp } from './WhatsApp'
import { singleton } from '@/core/injection'
import { PgCrudRepository } from '@/addon/repository/pg'
import { IWhatsAppRepository } from './IWhatsAppRepository'

@singleton()
export class PgWhatsAppRepository
  extends PgCrudRepository<WhatsApp>
  implements IWhatsAppRepository
{
  constructor(pool: Pool) {
    super(pool, {
      table: 'whatsapp',
      constructor: WhatsApp,
      schema: 'wabot',
    })
  }

  async findBySlug(slug: string): Promise<WhatsApp | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data @> $1
      LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify({ slug })])
    return items.at(0) ?? null
  }

  async findByBusinessNumber(number: string): Promise<WhatsApp | null> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table}
      WHERE data->'businessNumbers' @> $1
      LIMIT 1
    `
    const items = await this.query(sql, [JSON.stringify([{ number }])])
    return items.at(0) ?? null
  }
}
