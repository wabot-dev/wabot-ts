// Bridging the `@query` name DSL to a table whose columns are snake_case.
//
// A method name is PascalCase by construction, so `findOneByFundingOpportunityId`
// can only ever derive the field `fundingOpportunityId`. On a table the app
// inherited — Rails, Django, anything older than this framework — the field is
// `funding_opportunity_id`, and the query would look for a field that does not
// exist: silently empty on the memory backend, a missing-column error on
// Postgres.
//
// A repository that declares `fields` has said what its fields are called, so
// the derived name is matched against that list: the name as written first,
// then its snake_case form. Nothing is rewritten unless the snake_case spelling
// is one of the declared fields, so a repository that never uses them is
// unaffected.

import { IQueryAst } from './types'

/** `fundingOpportunityId` → `funding_opportunity_id`. */
export function toSnakeCase(name: string): string {
  return name.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
}

// The framework owns these two and maps them to `id`/`created_at` itself.
const RESERVED_FIELDS = new Set(['id', 'createdAt'])

/**
 * The declared field a DSL-derived name refers to. The name as written wins;
 * its snake_case form is the fallback, and only when the repository declared
 * a field by that name.
 */
export function resolveFieldName(field: string, fields: string[] | undefined): string {
  if (!fields?.length) return field
  if (RESERVED_FIELDS.has(field) || fields.includes(field)) return field
  const snake = toSnakeCase(field)
  return fields.includes(snake) ? snake : field
}

/**
 * The same query, with every field name resolved against the repository's
 * declared `fields`. Returns the AST untouched when nothing needs renaming, so
 * the common case allocates nothing.
 */
export function resolveAstFields(ast: IQueryAst, fields: string[] | undefined): IQueryAst {
  if (!fields?.length) return ast

  let changed = false
  const conditions = ast.conditions.map((condition) => {
    const field = resolveFieldName(condition.field, fields)
    if (field === condition.field) return condition
    changed = true
    return { ...condition, field }
  })
  const orderBy = ast.orderBy.map((order) => {
    const field = resolveFieldName(order.field, fields)
    if (field === order.field) return order
    changed = true
    return { ...order, field }
  })

  return changed ? { ...ast, conditions, orderBy } : ast
}
