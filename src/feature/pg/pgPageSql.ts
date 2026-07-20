import { IQueryCondition } from '@/feature/repository'
import { buildWhereClause } from './buildQuerySql'

export interface IBuiltPage {
  sql: string
  buildParams: (conditionArgs: unknown[]) => unknown[]
}

export interface IPageSqlOptions {
  limit: number
  cursorCreatedAt?: Date
  cursorId?: string
}

/**
 * Keyset (cursor) page query: filter by `conditions`, order by
 * `created_at DESC, id DESC`, and fetch `limit + 1` rows so the caller can
 * detect a next page. With a cursor, only rows strictly after it in that order
 * are returned (row-value comparison on `(created_at, id)`).
 */
export function buildPageSql(
  table: string,
  columns: string,
  conditions: IQueryCondition[],
  promotedColumns: string[],
  options: IPageSqlOptions,
): IBuiltPage {
  const where = buildWhereClause(conditions, promotedColumns)
  const hasCursor = options.cursorId !== undefined && options.cursorCreatedAt !== undefined

  let whereSql = where.sql
  if (hasCursor) {
    const keyset = `(created_at, id) < ($${where.argCount + 1}, $${where.argCount + 2})`
    whereSql = whereSql ? `${whereSql} AND ${keyset}` : ` WHERE ${keyset}`
  }

  const limit = Math.max(1, Math.floor(options.limit))
  const sql =
    `SELECT ${columns} FROM ${table}${whereSql}` +
    ` ORDER BY created_at DESC, id DESC LIMIT ${limit + 1}`

  return {
    buildParams: (conditionArgs) =>
      hasCursor
        ? [...conditionArgs, options.cursorCreatedAt, options.cursorId]
        : [...conditionArgs],
    sql,
  }
}
