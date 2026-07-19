import { IQueryAst, QueryOperator } from './types'

/**
 * Engine-neutral index kind. Each backend maps it to a concrete index:
 * - `exact`    — equality/membership lookups (Postgres: btree, expression or column).
 * - `range`    — comparisons and ORDER BY (Postgres: btree; also serves equality).
 * - `contains` — JSON/array containment (Postgres: GIN).
 * - `text`     — substring / LIKE search (Postgres: trigram GIN).
 */
export type IndexKind = 'exact' | 'range' | 'contains' | 'text'

export interface IIndexDecl {
  /** Entity field names (usually one; multiple = composite). */
  fields: string[]
  kind?: IndexKind
  unique?: boolean
  /** Suppress an otherwise auto-derived index for these fields. */
  disabled?: boolean
}

const EXACT_OPS = new Set<QueryOperator>(['Equals', 'Not', 'In', 'NotIn', 'IsNull', 'IsNotNull'])
const RANGE_OPS = new Set<QueryOperator>(['Gt', 'Gte', 'Lt', 'Lte'])
const TEXT_OPS = new Set<QueryOperator>(['Like', 'NotLike'])

// btree (range) also serves equality, so it wins over a plain exact index when a
// field is used both ways.
function strongestKind(kinds: Set<IndexKind>): IndexKind {
  if (kinds.has('range')) return 'range'
  if (kinds.has('exact')) return 'exact'
  return 'text'
}

/**
 * Derive single-field index declarations from a repository's query-method ASTs.
 * `id` is skipped (it is the primary key). A field filtered by equality yields
 * an `exact` index; used in comparisons or ORDER BY yields `range`; used with
 * LIKE yields `text`. The result is merged with the developer's explicit
 * `indexes` via {@link mergeIndexes}, so auto-indexing is the default and the
 * developer can add to or opt out of it.
 */
export function deriveIndexes(asts: IQueryAst[]): IIndexDecl[] {
  const byField = new Map<string, Set<IndexKind>>()

  const add = (field: string, kind: IndexKind) => {
    if (field === 'id') return
    let kinds = byField.get(field)
    if (!kinds) {
      kinds = new Set()
      byField.set(field, kinds)
    }
    kinds.add(kind)
  }

  for (const ast of asts) {
    for (const cond of ast.conditions) {
      if (EXACT_OPS.has(cond.operator)) add(cond.field, 'exact')
      else if (RANGE_OPS.has(cond.operator)) add(cond.field, 'range')
      else if (TEXT_OPS.has(cond.operator)) add(cond.field, 'text')
    }
    for (const order of ast.orderBy) add(order.field, 'range')
  }

  return [...byField.entries()].map(([field, kinds]) => ({
    fields: [field],
    kind: strongestKind(kinds),
  }))
}

const indexKey = (decl: IIndexDecl): string => decl.fields.join(',')

/**
 * Merge developer-declared indexes with auto-derived ones. An explicit
 * declaration for the same field set wins (and `disabled: true` opts out of the
 * auto index entirely).
 */
export function mergeIndexes(explicit: IIndexDecl[], derived: IIndexDecl[]): IIndexDecl[] {
  const explicitKeys = new Set(explicit.map(indexKey))
  const out = explicit.filter((d) => !d.disabled)
  for (const d of derived) {
    if (!explicitKeys.has(indexKey(d))) out.push(d)
  }
  return out
}
