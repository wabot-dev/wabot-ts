import { IQueryAst, IQueryCondition, QueryOperator } from '@/feature/repository'

export interface IBuiltQuery {
  sql: string
  argCount: number
  buildParams: (args: any[]) => any[]
}

// Fields backed by a real top-level column are routed to that column instead of
// extracting from the JSON blob: this uses the column's index and preserves its
// native type for ordering/comparison. `id`/`created_at` are always columns;
// promoted `add.columns` fields (passed in) join them. Every other field falls
// back to `data->>'field'`, which yields TEXT — so ORDER BY on numeric JSON
// fields is lexicographic and In/NotIn compare as text. Promote sortable hot
// paths with add.columns.
const RESERVED_COLUMN_BY_FIELD: Record<string, string> = {
  id: 'id',
  createdAt: 'created_at',
}

/**
 * Fields backed by a real column. `'all'` is the column storage strategy with
 * no `fields` projection: there is no `data` blob to fall back to, so every
 * field is a column.
 */
export type IPromotedColumns = string[] | 'all'

interface IFieldResolver {
  /** Whether the field is backed by a native typed column (reserved or promoted). */
  isNative(field: string): boolean
  /** SQL reference to the field: a column name, or a `data->>'field'` extraction. */
  ref(field: string): string
}

function escapeJsonKey(field: string): string {
  return field.replace(/'/g, "''")
}

function makeFieldResolver(promotedColumns: Set<string> | 'all'): IFieldResolver {
  const promoted = (field: string) => promotedColumns === 'all' || promotedColumns.has(field)
  return {
    isNative(field: string): boolean {
      return (
        Object.prototype.hasOwnProperty.call(RESERVED_COLUMN_BY_FIELD, field) || promoted(field)
      )
    },
    ref(field: string): string {
      const reserved = RESERVED_COLUMN_BY_FIELD[field]
      if (reserved) return reserved
      if (promoted(field)) return `"${field}"`
      return `data->>'${escapeJsonKey(field)}'`
    },
  }
}

function resolverFor(promotedColumns: IPromotedColumns): IFieldResolver {
  return makeFieldResolver(promotedColumns === 'all' ? 'all' : new Set(promotedColumns))
}

function operatorArity(op: QueryOperator): number {
  if (op === 'IsNull' || op === 'IsNotNull') return 0
  return 1
}

function fieldExpr(field: string, op: QueryOperator, res: IFieldResolver): string {
  const ref = res.ref(field)
  if (op === 'Gt' || op === 'Gte' || op === 'Lt' || op === 'Lte') {
    if (res.isNative(field)) return ref
    return `(${ref})::numeric`
  }
  return ref
}

function renderCondition(cond: IQueryCondition, paramIndex: number, res: IFieldResolver): string {
  const lhs = fieldExpr(cond.field, cond.operator, res)
  const native = res.isNative(cond.field)
  const numCast = native ? '' : '::numeric'
  // Note: for JSON fields In/NotIn cast the param to text[]; passing non-text
  // JSON values (numbers, booleans) relies on pg's TEXT serialization. Native
  // columns compare against the param directly with no cast.
  const arrCast = native ? '' : '::text[]'
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

function renderWhere(
  conditions: IQueryCondition[],
  res: IFieldResolver,
): { sql: string; argCount: number } {
  if (conditions.length === 0) return { sql: '', argCount: 0 }
  const parts: string[] = []
  let paramIndex = 1
  conditions.forEach((cond, i) => {
    const piece = renderCondition(cond, paramIndex, res)
    paramIndex += operatorArity(cond.operator)
    if (i === 0) {
      parts.push(piece)
    } else {
      parts.push((cond.connector ?? 'And').toUpperCase(), piece)
    }
  })
  return { sql: ` WHERE ${parts.join(' ')}`, argCount: paramIndex - 1 }
}

function renderOrderBy(ast: IQueryAst, res: IFieldResolver): string {
  if (ast.orderBy.length === 0) return ''
  const parts = ast.orderBy.map((o) => `${res.ref(o.field)} ${o.direction}`)
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
  res: IFieldResolver,
): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions, res)
  const order = renderOrderBy(ast, res)
  const limit = renderLimit(ast)
  const sql = `SELECT ${columns} FROM ${table}${where.sql}${order}${limit}`
  return { sql, argCount: where.argCount }
}

function buildCountSql(
  ast: IQueryAst,
  table: string,
  res: IFieldResolver,
): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions, res)
  const sql = `SELECT COUNT(*)::int AS count FROM ${table}${where.sql}`
  return { sql, argCount: where.argCount }
}

function buildExistsSql(
  ast: IQueryAst,
  table: string,
  res: IFieldResolver,
): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions, res)
  const sql = `SELECT EXISTS(SELECT 1 FROM ${table}${where.sql} LIMIT 1) AS "exists"`
  return { sql, argCount: where.argCount }
}

function buildDeleteSql(
  ast: IQueryAst,
  table: string,
  res: IFieldResolver,
): { sql: string; argCount: number } {
  const where = renderWhere(ast.conditions, res)
  const sql = `DELETE FROM ${table}${where.sql}`
  return { sql, argCount: where.argCount }
}

/** Render just the WHERE clause for a set of conditions (used by keyset pagination). */
export function buildWhereClause(
  conditions: IQueryCondition[],
  promotedColumns: IPromotedColumns = [],
): { sql: string; argCount: number } {
  return renderWhere(conditions, resolverFor(promotedColumns))
}

export function buildQuerySql(
  ast: IQueryAst,
  table: string,
  columns: string,
  promotedColumns: IPromotedColumns = [],
): IBuiltQuery {
  const res = resolverFor(promotedColumns)
  let sql: string
  let argCount: number

  switch (ast.prefix) {
    case 'find':
    case 'findOne': {
      const r = buildSelectSql(ast, table, columns, res)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'count': {
      const r = buildCountSql(ast, table, res)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'exists': {
      const r = buildExistsSql(ast, table, res)
      sql = r.sql
      argCount = r.argCount
      break
    }
    case 'delete': {
      const r = buildDeleteSql(ast, table, res)
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
