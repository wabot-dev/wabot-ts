import { createHash } from 'node:crypto'

// Pure helpers for the plain-SQL migration system. No filesystem or database
// here, so they are trivially unit-testable.

export interface IParsedMigration {
  /** Numeric prefix used for ordering. */
  order: number
  /** Filename without the .sql extension — the tracking key. */
  id: string
}

/** Parse `0001_create_users.sql` → { order: 1, id: '0001_create_users' }. Non-migration names → null. */
export function parseMigrationName(filename: string): IParsedMigration | null {
  if (!filename.endsWith('.sql')) return null
  const id = filename.slice(0, -'.sql'.length)
  const match = /^(\d+)/.exec(id)
  if (!match) return null
  return { order: parseInt(match[1], 10), id }
}

/** Stable checksum of a migration's SQL (CRLF-normalized so line endings don't cause drift). */
export function computeChecksum(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
}

/** Next zero-padded filename after the highest existing order, e.g. `0004_add_index.sql`. */
export function nextMigrationFilename(existingIds: string[], name: string): string {
  let max = 0
  for (const id of existingIds) {
    const match = /^(\d+)/.exec(id)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  const order = String(max + 1).padStart(4, '0')
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'migration'
  return `${order}_${slug}.sql`
}

export interface IMigrationFileRef {
  id: string
  checksum: string
}

export interface IAppliedMigration {
  name: string
  checksum: string
}

export interface IMigrationPlan {
  /** Ids present on disk but not yet applied, in file order. */
  pending: string[]
  /** Ids whose file checksum differs from what was applied (edited after the fact). */
  drifted: string[]
  /** Applied ids whose file is gone from disk. */
  missing: string[]
}

/** Compare on-disk migrations (in order) with the applied set. */
export function planMigrations(
  all: IMigrationFileRef[],
  applied: IAppliedMigration[],
): IMigrationPlan {
  const appliedChecksums = new Map(applied.map((a) => [a.name, a.checksum]))
  const allIds = new Set(all.map((f) => f.id))

  const pending: string[] = []
  const drifted: string[] = []
  for (const file of all) {
    const appliedChecksum = appliedChecksums.get(file.id)
    if (appliedChecksum === undefined) pending.push(file.id)
    else if (appliedChecksum !== file.checksum) drifted.push(file.id)
  }
  const missing = applied.filter((a) => !allIds.has(a.name)).map((a) => a.name)

  return { pending, drifted, missing }
}
