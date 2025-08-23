import type { Pool } from 'pg'
import type { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { Entity, IEntityData } from '@/core/entity'

export class PgRepositoryBase<P extends Entity<IEntityData>> {
  private tableIsCreated = false
  protected schema: string
  protected table: string
  protected columnsList: string[]
  protected columnsAndTypes: string
  protected columns: string
  protected vars: string
  protected updates: string

  public addColumns: {
    [columns: string]: {
      type: string
      value: (item: P) => number | boolean | string | null | Date
    }
  }

  constructor(
    protected pool: Pool,
    protected config: IPgRepositoryConfig<any>,
  ) {
    this.schema = `"${config.schema ?? 'public'}"`

    this.table = [config.schema, config.table]
      .filter((x) => x && x.trim())
      .map((x) => `"${x}"`)
      .join('.')

    this.addColumns = config.add?.columns ?? {}
    this.columnsList = ['id', 'created_at', 'data', ...Object.keys(this.addColumns)]

    this.columnsAndTypes = [
      '"id" TEXT PRIMARY KEY',
      '"created_at" TIMESTAMP',
      '"data" JSONB',
      ...this.columnsList.slice(3).map((x) => `${x} ${this.addColumns[x].type}`),
    ].join(', ')

    this.columns = this.columnsList.map((x) => `"${x}"`).join(', ')
    this.vars = this.columnsList.map((_, i) => `$${i + 1}`).join(', ')
    this.updates = this.columnsList.map((x, i) => `"${x}" = $${i + 1}`).join(', ')
  }

  protected values(item: P) {
    return [
      item.id,
      item.createdAt,
      JSON.stringify(item['data']),
      ...this.columnsList.slice(3).map((x) => this.addColumns[x].value(item)),
    ]
  }

  protected async exec(sql: string, values: any[]) {
    const conn = await this.connect()
    await conn.query(sql, values)
  }

  protected async query(sql: string, values: any[]) {
    const conn = await this.connect()
    const { rows } = await conn.query(sql, values)
    return rows.map((row) => new this.config.constructor(row.data))
  }

  protected async connect() {
    await this.ensureTable()
    return this.pool
  }

  protected async ensureTable() {
    if (this.tableIsCreated) {
      return
    }

    const schemaQuery = `
      CREATE SCHEMA IF NOT EXISTS ${this.schema}
    `

    const tableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.table} (
      ${this.columnsAndTypes}
      )
    `
    await this.pool.query(schemaQuery)
    await this.pool.query(tableQuery)
    await this.ensureColumns()
  }

  protected async ensureColumns(): Promise<void> {
    const { rows: existing } = await this.pool.query<{
      column_name: string
    }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = $2
    `,
      [this.config.table, this.config.schema ?? 'public'],
    )

    const existingColumns = new Set(existing.map((col) => col.column_name))

    for (let i = 0; i < this.columnsList.length; i++) {
      const col = this.columnsList[i]
      const columnAndType = this.columnsAndTypes[0]
      if (!existingColumns.has(col)) {
        const alterSql = `ALTER TABLE ${this.table} ADD COLUMN ${columnAndType}`
        console.log(`[INFO] Adding column: ${alterSql}`)
        await this.pool.query(alterSql)
      }
    }
  }
}
