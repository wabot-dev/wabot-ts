import { Pool } from 'pg'
import { generate as generateShortUuid } from 'short-uuid'

import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import {
  IPage,
  IPageOptions,
  IQueryAst,
  IQueryCondition,
  IRepositoryRuntime,
  buildPage,
  decodeCursor,
} from '@/feature/repository'
import { DbRepositoryExtension } from '@/feature/repository/DbRepositoryExtension'
import { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { buildQuerySql } from './buildQuerySql'
import { buildPageSql } from './pgPageSql'
import { columnarInsertSql, columnarSelectList, columnarUpdateSql } from './pgColumnarSql'
import { withPgClient } from './withPgClient'

/**
 * Relational (pg-sql) repository base: stores each entity field in a real typed
 * column instead of a JSONB blob, so queries and indexes use native columns.
 * The table and columns are owned by SQL migrations (no auto-DDL here).
 *
 * It IS the runtime for repositories whose `@dbExtension` extends it, and the
 * base custom `@dbExtension` classes extend to add hand-written SQL. Business
 * code sees the same repository interface as the JSONB strategy, so switching a
 * repository to relational storage is local to its extension + migrations.
 *
 * Requires every queried field to be declared in `config.columns` (there is no
 * `data` blob to fall back to).
 */
export class PgSqlRepositoryBase<P extends Entity<IEntityData>>
  extends DbRepositoryExtension
  implements IRepositoryRuntime<P>
{
  protected table: string
  protected columnFields: string[]
  protected selectColumns: string

  constructor(
    protected pool: Pool,
    protected config: IPgRepositoryConfig<any>,
  ) {
    super()
    this.table = [config.schema, config.table]
      .filter((x) => x && x.trim())
      .map((x) => `"${x}"`)
      .join('.')
    this.columnFields = config.columns ?? []
    this.selectColumns = columnarSelectList(this.columnFields)
  }

  protected async query(sql: string, params: any[]): Promise<P[]> {
    return withPgClient(this.pool, async (client) => {
      const { rows } = await client.query(sql, params)
      return rows.map((row) => this.deserialize(row))
    })
  }

  protected async exec(sql: string, params: any[]): Promise<void> {
    await withPgClient(this.pool, async (client) => {
      await client.query(sql, params)
    })
  }

  protected deserialize(row: any): P {
    const data: any = {
      id: row.id,
      createdAt: row.created_at instanceof Date ? row.created_at.getTime() : row.created_at,
    }
    for (const field of this.columnFields) {
      data[field] = row[field]
    }
    return new this.config.constructor(data)
  }

  protected values(item: P): any[] {
    return [
      item.id,
      item.createdAt,
      ...this.columnFields.map((f) => (item['data'] as Record<string, any>)[f] ?? null),
    ]
  }

  async find(id: string): Promise<P | null> {
    const sql = `SELECT ${this.selectColumns} FROM ${this.table} WHERE id = $1 LIMIT 1`
    const items = await this.query(sql, [id])
    return items.at(0) ?? null
  }

  async findOrThrow(id: string): Promise<P> {
    const item = await this.find(id)
    if (!item) {
      throw new CustomError({
        message: `Not found ${this.config.constructor.name} with id = '${id}'`,
        httpCode: 404,
      })
    }
    return item
  }

  async findByIds(ids: string[]): Promise<P[]> {
    if (ids.length === 0) return []
    const placeholders = ids.map((_, i) => '$' + (i + 1)).join(', ')
    const sql = `SELECT ${this.selectColumns} FROM ${this.table} WHERE id IN (${placeholders})`
    return this.query(sql, ids)
  }

  async findAll(): Promise<P[]> {
    return this.query(`SELECT ${this.selectColumns} FROM ${this.table}`, [])
  }

  async create(item: P): Promise<void> {
    if (item.wasCreated()) {
      throw new Error('Item already created')
    }
    item['data'].id = generateShortUuid()
    item['data'].createdAt = new Date().getTime()
    item.validate()
    await this.exec(columnarInsertSql(this.table, this.columnFields), this.values(item))
  }

  async restore(item: P): Promise<void> {
    item.validate()
    await this.exec(columnarInsertSql(this.table, this.columnFields), this.values(item))
  }

  async update(item: P): Promise<void> {
    item.validate()
    const sql = columnarUpdateSql(this.table, this.columnFields)
    if (!sql) return // nothing mutable to update
    const params = [
      ...this.columnFields.map((f) => (item['data'] as Record<string, any>)[f] ?? null),
      item.id,
    ]
    await this.exec(sql, params)
  }

  async delete(item: P): Promise<void> {
    await this.exec(`DELETE FROM ${this.table} WHERE id = $1`, [item.id])
  }

  async runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.columnFields)
    return this.query(built.sql, built.buildParams(args))
  }

  async runCount(ast: IQueryAst, args: unknown[]): Promise<number> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.columnFields)
    return withPgClient(this.pool, async (client) => {
      const result = await client.query(built.sql, built.buildParams(args))
      return result.rows[0]?.count ?? 0
    })
  }

  async runExists(ast: IQueryAst, args: unknown[]): Promise<boolean> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.columnFields)
    return withPgClient(this.pool, async (client) => {
      const result = await client.query(built.sql, built.buildParams(args))
      return Boolean(result.rows[0]?.exists)
    })
  }

  async runDelete(ast: IQueryAst, args: unknown[]): Promise<void> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.columnFields)
    await this.exec(built.sql, built.buildParams(args))
  }

  async runPage(
    conditions: IQueryCondition[],
    args: unknown[],
    options: IPageOptions,
  ): Promise<IPage<P>> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined
    const built = buildPageSql(this.table, this.selectColumns, conditions, this.columnFields, {
      cursorCreatedAt: cursor ? new Date(cursor.createdAt) : undefined,
      cursorId: cursor?.id,
      limit: options.limit,
    })
    const rows = await this.query(built.sql, built.buildParams(args))
    return buildPage(rows, Math.max(1, Math.floor(options.limit)))
  }
}

/** The relational (pg-sql) strategy base a `@dbExtension` extends to opt in. */
export { PgSqlRepositoryBase as PgSqlRepositoryExtension }
