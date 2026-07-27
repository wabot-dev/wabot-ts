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
import { buildQuerySql, type IPromotedColumns } from './buildQuerySql'
import { buildPageSql } from './pgPageSql'
import { columnarInsertSql, columnarSelectList, columnarUpdateSql } from './pgColumnarSql'
import { withPgClient } from './withPgClient'
import { PG_COLUMNS } from './pgEngine'

/**
 * Column-storage repository base: every entity field is a real typed column
 * instead of a JSONB blob, so queries and indexes use native columns. The table
 * is owned by SQL migrations (no auto-DDL here).
 *
 * It IS the runtime for repositories that declare `PgColumnsRepository`, and
 * the base a `@dbExtension` extends to add hand-written SQL. Business code sees
 * the same repository interface as the document strategy, so moving a
 * repository between the two is local to its base class + migrations.
 *
 * `config.fields` narrows it to a projection: those fields alone are read and
 * written, and anything else in the row is invisible to this repository. With
 * no projection the row itself decides — reads take every column, and a write
 * names the fields the entity carries.
 */
export class PgSqlRepositoryBase<P extends Entity<IEntityData>>
  extends DbRepositoryExtension
  implements IRepositoryRuntime<P>
{
  /** Which repositories this extension may serve: Postgres, column storage. */
  static readonly storage = PG_COLUMNS

  protected table: string
  /** The declared projection, or `[]` when the repository takes the whole row. */
  protected columnFields: string[]
  protected selectColumns: string
  /** Field references for the SQL builders: every field is a column here. */
  protected promotedColumns: IPromotedColumns

  constructor(
    protected pool: Pool,
    protected config: IPgRepositoryConfig<any>,
  ) {
    super()
    this.table = [config.schema, config.table]
      .filter((x) => x && x.trim())
      .map((x) => `"${x}"`)
      .join('.')
    // `columns` is the pre-`fields` name for the same projection.
    this.columnFields = config.fields ?? config.columns ?? []
    const projected = this.columnFields.length > 0
    // Without a projection the table's own shape decides what is read, so the
    // repository does not need to know the column list up front.
    this.selectColumns = projected ? columnarSelectList(this.columnFields) : '*'
    this.promotedColumns = projected ? this.columnFields : 'all'
  }

  /**
   * Columns a write touches: the projection when there is one, otherwise the
   * fields the entity itself carries. A field the entity leaves out stays out
   * of the statement, so the column keeps its default instead of being nulled.
   */
  protected writeFields(item: P): string[] {
    if (this.columnFields.length > 0) return this.columnFields
    return Object.keys(item['data'] as Record<string, unknown>).filter(
      (field) => field !== 'id' && field !== 'createdAt',
    )
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
    if (this.columnFields.length > 0) {
      for (const field of this.columnFields) {
        data[field] = row[field]
      }
    } else {
      // No projection: the row is the entity. Whatever columns came back are
      // its fields, minus the two the framework owns.
      for (const [column, value] of Object.entries(row)) {
        if (column === 'id' || column === 'created_at') continue
        data[column] = value
      }
    }
    return new this.config.constructor(data)
  }

  protected values(item: P, fields: string[] = this.writeFields(item)): any[] {
    return [
      item.id,
      item.createdAt,
      ...fields.map((f) => (item['data'] as Record<string, any>)[f] ?? null),
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
    await this.insert(item)
  }

  async restore(item: P): Promise<void> {
    item.validate()
    await this.insert(item)
  }

  private async insert(item: P): Promise<void> {
    const fields = this.writeFields(item)
    await this.exec(columnarInsertSql(this.table, fields), this.values(item, fields))
  }

  async update(item: P): Promise<void> {
    item.validate()
    const fields = this.writeFields(item)
    const sql = columnarUpdateSql(this.table, fields)
    if (!sql) return // nothing mutable to update
    const params = [...fields.map((f) => (item['data'] as Record<string, any>)[f] ?? null), item.id]
    await this.exec(sql, params)
  }

  async delete(item: P): Promise<void> {
    await this.exec(`DELETE FROM ${this.table} WHERE id = $1`, [item.id])
  }

  async runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.promotedColumns)
    return this.query(built.sql, built.buildParams(args))
  }

  async runCount(ast: IQueryAst, args: unknown[]): Promise<number> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.promotedColumns)
    return withPgClient(this.pool, async (client) => {
      const result = await client.query(built.sql, built.buildParams(args))
      return result.rows[0]?.count ?? 0
    })
  }

  async runExists(ast: IQueryAst, args: unknown[]): Promise<boolean> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.promotedColumns)
    return withPgClient(this.pool, async (client) => {
      const result = await client.query(built.sql, built.buildParams(args))
      return Boolean(result.rows[0]?.exists)
    })
  }

  async runDelete(ast: IQueryAst, args: unknown[]): Promise<void> {
    const built = buildQuerySql(ast, this.table, this.selectColumns, this.promotedColumns)
    await this.exec(built.sql, built.buildParams(args))
  }

  async runPage(
    conditions: IQueryCondition[],
    args: unknown[],
    options: IPageOptions,
  ): Promise<IPage<P>> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined
    const built = buildPageSql(this.table, this.selectColumns, conditions, this.promotedColumns, {
      cursorCreatedAt: cursor ? new Date(cursor.createdAt) : undefined,
      cursorId: cursor?.id,
      limit: options.limit,
    })
    const rows = await this.query(built.sql, built.buildParams(args))
    return buildPage(rows, Math.max(1, Math.floor(options.limit)))
  }
}

/** The column-storage base a `@dbExtension` extends to write SQL by hand. */
export { PgSqlRepositoryBase as PgColumnsRepositoryExtension }

/** @deprecated Use `PgColumnsRepositoryExtension`. */
export { PgSqlRepositoryBase as PgSqlRepositoryExtension }
