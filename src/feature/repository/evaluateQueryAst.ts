import { Entity, IEntityData } from '@/core/entity'
import { IQueryAst, IQueryCondition, QueryOperator } from './types'

function getField(item: any, field: string): any {
  return item?.data?.[field]
}

function compare(a: any, b: any): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function likeToRegex(pattern: string): RegExp {
  let regex = ''
  for (const ch of pattern) {
    if (ch === '%') regex += '.*'
    else if (ch === '_') regex += '.'
    else regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + regex + '$')
}

function operatorArity(op: QueryOperator): number {
  if (op === 'IsNull' || op === 'IsNotNull') return 0
  return 1
}

function applyOperator(value: any, op: QueryOperator, arg: any): boolean {
  switch (op) {
    case 'Equals':
      return value == arg
    case 'Not':
      return value != arg
    case 'Like':
      if (value == null) return false
      return likeToRegex(String(arg)).test(String(value))
    case 'NotLike':
      if (value == null) return false
      return !likeToRegex(String(arg)).test(String(value))
    case 'In':
      return Array.isArray(arg) && arg.some((x) => x == value)
    case 'NotIn':
      return Array.isArray(arg) && !arg.some((x) => x == value)
    case 'Gt':
      return value != null && arg != null && compare(value, arg) > 0
    case 'Gte':
      return value != null && arg != null && compare(value, arg) >= 0
    case 'Lt':
      return value != null && arg != null && compare(value, arg) < 0
    case 'Lte':
      return value != null && arg != null && compare(value, arg) <= 0
    case 'IsNull':
      return value == null
    case 'IsNotNull':
      return value != null
  }
}

interface IConditionWithArg {
  cond: IQueryCondition
  arg: any
}

function bindArgs(conditions: IQueryCondition[], args: unknown[]): IConditionWithArg[] {
  let expectedArity = 0
  for (const c of conditions) expectedArity += operatorArity(c.operator)
  if (args.length !== expectedArity) {
    throw new Error(`Query expected ${expectedArity} argument(s), received ${args.length}`)
  }
  const bound: IConditionWithArg[] = []
  let idx = 0
  for (const cond of conditions) {
    if (operatorArity(cond.operator) === 0) {
      bound.push({ cond, arg: undefined })
    } else {
      bound.push({ cond, arg: args[idx] })
      idx += 1
    }
  }
  return bound
}

// Matches SQL precedence: AND binds tighter than OR.
// Group consecutive conditions joined by And; start a new group on Or; OR across groups.
function matches<P extends Entity<IEntityData>>(item: P, bound: IConditionWithArg[]): boolean {
  if (bound.length === 0) return true

  const groups: IConditionWithArg[][] = [[]]
  for (const entry of bound) {
    if (entry.cond.connector === 'Or' && groups[groups.length - 1].length > 0) {
      groups.push([entry])
    } else {
      groups[groups.length - 1].push(entry)
    }
  }

  return groups.some((group) =>
    group.every(({ cond, arg }) => applyOperator(getField(item, cond.field), cond.operator, arg)),
  )
}

function sortByOrderBy<P extends Entity<IEntityData>>(items: P[], ast: IQueryAst): P[] {
  if (ast.orderBy.length === 0) return items
  const copy = [...items]
  copy.sort((a, b) => {
    for (const o of ast.orderBy) {
      const av = getField(a, o.field)
      const bv = getField(b, o.field)
      const c = compare(av, bv)
      if (c !== 0) return o.direction === 'ASC' ? c : -c
    }
    return 0
  })
  return copy
}

function applyLimit<P extends Entity<IEntityData>>(items: P[], ast: IQueryAst): P[] {
  if (ast.prefix === 'findOne') return items.slice(0, 1)
  if (ast.limit !== undefined) return items.slice(0, ast.limit)
  return items
}

export function evaluateQueryAst<P extends Entity<IEntityData>>(
  items: Iterable<P>,
  ast: IQueryAst,
  args: unknown[],
): P[] {
  const bound = bindArgs(ast.conditions, args)
  const filtered: P[] = []
  for (const item of items) {
    if (matches(item, bound)) filtered.push(item)
  }
  const sorted = sortByOrderBy(filtered, ast)
  return applyLimit(sorted, ast)
}
