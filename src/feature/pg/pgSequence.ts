import { Pool } from 'pg'

import { withPgClient } from './withPgClient'

/**
 * The next value of a database sequence, as the string an entity id is.
 *
 * The name is passed as a parameter cast to `regclass` rather than pasted into
 * the statement, so a schema-qualified name works and the identifier is never
 * concatenated into SQL. Goes through `withPgClient`, so drawing a number
 * inside an open transaction uses that transaction's connection — which is what
 * lets a caller reference the id in the same unit of work as the INSERT.
 *
 * Sequences are deliberately outside transactions: a rolled-back insert still
 * consumes its number, so ids have gaps. That is true of `bigserial` too.
 */
export async function nextSequenceValue(pool: Pool, sequence: string): Promise<string> {
  const value = await withPgClient(pool, async (client) => {
    const { rows } = await client.query(`SELECT nextval($1::regclass)::text AS id`, [sequence])
    return rows[0]?.id
  })
  if (value === undefined || value === null) {
    throw new Error(`Sequence "${sequence}" returned no value`)
  }
  return String(value)
}
