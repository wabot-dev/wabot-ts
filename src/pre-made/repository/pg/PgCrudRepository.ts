import type { IPersistent, IReversibleMapper, Persistent } from '@/shared'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import type { ICrudRepository } from '../ICrudRepository'
import type { IPgRecord } from './IPgRecord'

export class PgCrudRepository<P extends Persistent<IPersistent>, R extends IPgRecord = IPgRecord>
  implements ICrudRepository<P>
{
  private tableIsCreated = false

  constructor(
    protected readonly pool: Pool,
    protected readonly tableName: string,
    protected mapper: IReversibleMapper<P, R>,
  ) {}

  async find(id: string): Promise<P | null> {
    const columns = Object.keys(this.columns())

    const sql = `
      SELECT ${columns.join(',')}
        FROM ${this.tableName}
       WHERE id = $1
       LIMIT 1
    `
    const conn = await this.connect()
    const { rows } = await conn.query(sql, [id])
    if (rows.length === 0) return null
    return this.mapper.rev(rows[0])
  }

  async findAll(): Promise<P[]> {
    const columns = Object.keys(this.columns())
    const sql = `SELECT ${columns.join(',')} FROM ${this.tableName}`
    const conn = await this.connect()
    const { rows } = await conn.query(sql)
    return rows.map((r) => this.mapper.rev(r))
  }

  async create(item: P): Promise<void> {
    if (item.wasCreated()) {
      throw new Error('Item already created')
    }

    item['data'].id = uuidv4()
    item['data'].createdAt = new Date().getTime()

    item.validate()

    const entries = Object.entries(this.values(item))
    const columns = entries.map(([column]) => column)
    const vars = entries.map((_, i) => `$${i + 1}`)
    const values = entries.map(([_, value]) => value)

    const sql = `
      INSERT INTO ${this.tableName}(${columns.join(',')})
      VALUES (${vars.join(',')})
    `
    const conn = await this.connect()
    await conn.query(sql, values)
  }

  async update(item: P): Promise<void> {
    item.validate()

    const entries = Object.entries(this.values(item))
    const sets = entries.map(([column], i) => `${column} = $${i + 1}`)
    const values = entries.map(([_, value]) => value)

    const sql = `
      UPDATE ${this.tableName}
         SET ${sets.join(', ')}
      WHERE id = $${values.length + 1}
    `
    const conn = await this.connect()
    await conn.query(sql, [...values, item.getId()])
  }

  async discard(item: P): Promise<void> {
    item.discard()
    await this.update(item)
  }

  protected additionalColumns(): { [column: string]: string } {
    return {}
  }

  protected additionalValues(item: P): { [column: string]: any } {
    return {}
  }

  private columns() {
    return { id: 'TEXT PRIMARY KEY', data: 'JSONB NOT NULL', ...this.additionalColumns() }
  }

  private values(item: P) {
    return { id: item.getId(), data: this.mapper.map(item).data, ...this.additionalValues(item) }
  }

  protected async connect() {
    await this.createTableIfNotExists()
    return this.pool
  }

  private async createTableIfNotExists() {
    if (this.tableIsCreated) {
      return
    }

    const colsAndTypes = Object.entries(this.columns()).map(([col, type]) => `${col} ${type}`)

    const query = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
      ${colsAndTypes.join(',')}
      )
    `
    await this.pool.query(query)
    await this.ensureTableColumns()
  }

  async ensureTableColumns(): Promise<void> {
    const { rows: existing } = await this.pool.query<{
      column_name: string
    }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
    `,
      [this.tableName],
    )

    const existingColumns = new Set(existing.map((col) => col.column_name))

    for (const [col, type] of Object.entries(this.columns())) {
      if (!existingColumns.has(col)) {
        const alterSql = `ALTER TABLE "${this.tableName}" ADD COLUMN ${col} ${type}`
        console.log(`[INFO] Adding column: ${alterSql}`)
        await this.pool.query(alterSql)
      }
    }
  }
}
