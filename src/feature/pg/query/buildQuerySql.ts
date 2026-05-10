import { IQueryAst, IQueryCondition, QueryOperator } from './types'

export interface IBuiltQuery {
  sql: string
  argCount: number
  buildParams: (args: any[]) => any[]
}

// Fields stored as top-level columns; routed to the column instead of
// extracting from the JSON blob (uses the index, preserves native type
// for ordering/comparison). All other fields fall back to data->>'field',
// which yields TEXT — so ORDER BY on numeric JSON fields is lexicographic
// and In/NotIn compares as text. Use add.columns for sortable hot paths.
const RESERVED_COLUMN_BY_FIELD: Record<string, string> = {
  id: 'id',
  createdAt: 'created_at',
}

function operatorArity(op: QueryOperator): number {
  if (op === 'IsNull' || op === 'IsNotNull') return 0
  return 1
}

function escapeJsonKey(field: string): string {
  return field.replace(/'/g, "''")
}

function isReservedColumn(field: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESERVED_COLUMN_BY_FIELD, field)
}

function fieldRef(field: string): string {
  const reserved = RESERVED_COLUMN_BY_FIELD[field]
  if (reserved) return reserved
  return `data->>'${escapeJsonKey(field)}'`
}

function fieldExpr(field: string, op: QueryOperator): string {
  const ref = fieldRef(field)
  if (op === 'Gt' || op === 'Gte' || op === 'Lt' || op === 'Lte') {
    if (isReservedColumn(field)) return ref
    return `(${ref})::numeric`
  }
  return ref
}

function renderCondition(cond: IQueryCondition, paramIndex: number): string {
  const lhs = fieldExpr(cond.field, cond.operator)
  const reserved = isReservedColumn(cond.field)
  const numCast = reserved ? '' : '::numeric'
  // Note: In/NotIn cast the param to text[]; passing non-text JSON values
  // (numbers, booleans) relies on pg's TEXT serialization. For sortable
  // numeric fields, prefer a typed add.columns column.
  const arrCast = reserved ? '' : '::text[]'
  switch (cond.operator) {
    case 'Equals':
      return `${lhs} = $${paramIndex}`
    case 'Not':
      return `${lhs} <> $${paramIndex}`
    case 'Like':
      return `${lhs} LIKE $${paramIndex}`
    case 'NotLike':
      return `${lhs} NOT LIKE $${paramIndex}`
    case 'In':
      return `${lhs} = ANY($${paramIndex}${arrCast})`
    case 'NotIn':
      return `NOT (${lhs} = ANY($${paramIndex}${arrCast}))`
    case 'Gt':
      return `${lhs} > $${paramIndex}${numCast}`
    case 'Gte':
      return `${lhs} >= $${paramIndex}${numCast}`
    case 'Lt':
      return `${lhs} < $${paramIndex}${numCast}`
    case 'Lte':
      return `${lhs} <= $${paramIndex}${numCast}`
    // IS NULL matches both missing JSON keys and explicit JSON nulls
    // (PostgreSQL `data->>'k'` returns NULL for both cases).
    case 'IsNull':
      return `${lhs} IS NULL`
    case 'IsNotNull':
      return `${lhs} IS NOT NULL`
  }
}

function renderWhere(conditions: IQueryCondition[]): { sql: string; argCount: number } {
  if (conditions.length === 0) return { sql: '', argCount: 0 }
  const parts: string[] = []
  let paramIndex = 1
  conditions.forEach((cond, i) => {
    const piece = renderCondition(cond, paramIndex)
    paramIndex += operatorArity(cond.operator)
    if (i === 0) {
      parts.push(piece)
    } else {
      parts.push((cond.connector ?? 'And').toUpperCase(), piece)
    }
  })
  return { sql: ` WHERE ${parts.join(' ')}`, argCount: paramIndex - 1 }
}

function renderOrderBy(ast: IQueryAst): string {
  if (ast.orderBy.length === 0) return ''
  const parts = ast.orderBy.map((o) => `${fieldRef(o.field)} ${o.direction}`)
  return ` ORDER BY ${parts.join(', ')}`
}

function renderLimit(ast: IQueryAst): string {
  if (ast.prefix === 'findOne') return ' LIMIT 1'
  if (ast.limit !== undefined) return ` LIMIT ${ast.limit}`
  return ''
}

function buildSelectSql(
  ast: IQueryAst,
  table: string,
  columns: string,
): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions)
  const order = renderOrderBy(ast)
  const limit = renderLimit(ast)
  const sql = `SELECT ${columns} FROM ${table}${where.sql}${order}${limit}`
  return { sql, argCount: where.argCount }
}

function buildCountSql(ast: IQueryAst, table: string): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions)
  const sql = `SELECT COUNT(*)::int AS count FROM ${table}${where.sql}`
  return { sql, argCount: where.argCount }
}

function buildExistsSql(ast: IQueryAst, table: string): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions)
  const sql = `SELECT EXISTS(SELECT 1 FROM ${table}${where.sql} LIMIT 1) AS "exists"`
  return { sql, argCount: where.argCount }
}

function buildDeleteSql(ast: IQueryAst, table: string): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions)
  const sql = `DELETE FROM ${table}${where.sql}`
  return { sql, argCount: where.argCount }
}

export function buildQuerySql(ast: IQueryAst, table: string, columns: string): IBuiltQuery {
  let sql: string
  let argCount: number

  switch (ast.prefix) {
    case 'find':
    case 'findOne': {
      const r = buildSelectSql(ast, table, columns)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'count': {
      const r = buildCountSql(ast, table)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'exists': {
      const r = buildExistsSql(ast, table)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'delete': {
      const r = buildDeleteSql(ast, table)
      sql = r.sql
      argCount = r.argCount
      break
    }
  }

  const buildParams = (args: any[]): any[] => {
    if (args.length !== argCount) {
      throw new Error(`Query expected ${argCount} argument(s), received ${args.length}`)
    }
    return args
  }

  return { sql, argCount, buildParams }
}
