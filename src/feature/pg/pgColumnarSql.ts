// SQL builders for the relational (pg-sql) strategy, where every entity field
// is a real typed column instead of a JSONB blob. `id` and `created_at` are
// always present; `columnFields` are the entity's other fields, whose column
// name equals the field name. Pure and DB-free so they can be unit-tested.

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

export interface IColumnarWriteOptions {
  /**
   * The table assigns `id` itself (`id: 'database'`): leave the column out of
   * the statement so its default — a sequence, a trigger — supplies the value.
   */
  databaseId?: boolean
}

/** Ordered, quoted column identifiers: id, created_at, then the field columns. */
export function columnarColumns(
  columnFields: string[],
  options: IColumnarWriteOptions = {},
): string[] {
  const reserved = options.databaseId ? ['created_at'] : ['id', 'created_at']
  return [...reserved, ...columnFields].map(quoteIdent)
}

/** Comma-joined column list for SELECT / INSERT. */
export function columnarSelectList(columnFields: string[]): string {
  return columnarColumns(columnFields).join(', ')
}

/**
 * `INSERT INTO <table> (cols) VALUES ($1..$n)` — value order matches
 * columnarColumns. With `databaseId` the id is neither named nor passed, and
 * the statement reads back the one the table assigned.
 */
export function columnarInsertSql(
  table: string,
  columnFields: string[],
  options: IColumnarWriteOptions = {},
): string {
  const cols = columnarColumns(columnFields, options)
  const vars = cols.map((_, i) => `$${i + 1}`)
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vars.join(', ')})`
  return options.databaseId ? `${sql} RETURNING id` : sql
}

/**
 * `UPDATE <table> SET <field cols> WHERE id = $n`. id/created_at are immutable,
 * so only the field columns are updated; params are the field values followed
 * by the id. Returns null when there are no mutable field columns.
 */
export function columnarUpdateSql(table: string, columnFields: string[]): string | null {
  if (columnFields.length === 0) return null
  const sets = columnFields.map((f, i) => `${quoteIdent(f)} = $${i + 1}`)
  return `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${columnFields.length + 1}`
}
