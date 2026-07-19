import { createHash } from 'node:crypto'
import { IIndexDecl } from '@/feature/repository'

// Mirrors buildQuerySql: which entity fields map to native columns vs. a JSON
// extraction. An index built here must match the expression the query emits, or
// the planner will not use it.
const RESERVED_COLUMN_BY_FIELD: Record<string, string> = {
  id: 'id',
  createdAt: 'created_at',
}

function escapeJsonKey(field: string): string {
  return field.replace(/'/g, "''")
}

/**
 * The indexable element for a field: a native column reference when the field
 * is reserved or promoted, otherwise the `data->>'field'` extraction (matching
 * how equality queries reference it).
 */
function indexElement(field: string, promoted: Set<string>): string {
  const reserved = RESERVED_COLUMN_BY_FIELD[field]
  if (reserved) return `"${reserved}"`
  if (promoted.has(field)) return `"${field}"`
  return `(data->>'${escapeJsonKey(field)}')`
}

/** Deterministic, ≤63-byte index name (hashed suffix when the readable name is too long). */
function indexName(nameBase: string, decl: IIndexDecl): string {
  const raw = ['wabot', nameBase, ...decl.fields, decl.kind ?? 'exact', decl.unique ? 'uniq' : '']
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
  if (raw.length <= 63) return raw
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 8)
  return `${raw.slice(0, 54)}_${hash}`
}

/**
 * Translate an engine-neutral index declaration into a `CREATE INDEX IF NOT
 * EXISTS` statement for the given (already-qualified, quoted) table.
 *
 * - `exact` / `range` / `text` → btree over the resolved element(s). Native
 *   columns keep their type; JSON fields index the `data->>'field'` expression
 *   so equality lookups use it.
 * - `contains` → GIN over `data jsonb_path_ops`, serving `@>` containment
 *   (field list not applicable — one GIN serves all containment on the blob).
 *
 * Returns `null` when nothing sensible can be built (e.g. no fields for a
 * btree). The name is deterministic so re-runs are no-ops.
 */
export function buildIndexDdl(
  targetTable: string,
  nameBase: string,
  decl: IIndexDecl,
  promoted: Set<string>,
): string | null {
  const kind = decl.kind ?? 'exact'
  const name = indexName(nameBase, decl)

  if (kind === 'contains') {
    return `CREATE INDEX IF NOT EXISTS "${name}" ON ${targetTable} USING gin (data jsonb_path_ops)`
  }

  if (decl.fields.length === 0) return null

  const elements = decl.fields.map((f) => indexElement(f, promoted))
  const unique = decl.unique ? 'UNIQUE ' : ''
  return `CREATE ${unique}INDEX IF NOT EXISTS "${name}" ON ${targetTable} (${elements.join(', ')})`
}
