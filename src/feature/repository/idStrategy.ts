// How a repository gets the id of a newly created entity.
//
// The framework's own default is a short UUID assigned before the INSERT, which
// is what every repository got before this option existed. An app on a table it
// does not own needs something else: the id may be the table's to assign
// (`bigserial`, a trigger), or it may come from a sequence the app draws from
// itself — which, unlike the former, hands the value over *before* the row is
// written, so children and references can be built in the same transaction. A
// plain function covers everything else (a prefixed key, a ULID, a tenant id).

import { randomUUID } from 'node:crypto'
import { generate as generateShortUuid } from 'short-uuid'

/** Produces the id for an entity about to be inserted. */
export type IIdGenerator<P> = (item: P) => string | Promise<string>

/** Draw each id from a database sequence, by name (`nextval`). */
export interface IIdSequence {
  /**
   * The sequence to draw from — `'game_id_seq'`, or schema-qualified
   * (`'legacy.game_id_seq'`). It must already exist; the framework issues no
   * DDL for it.
   */
  sequence: string
}

/**
 * - `'short-uuid'` — the default: a short UUID assigned before the INSERT.
 * - `'uuid'` — RFC 4122 v4, for a `uuid` column.
 * - `'database'` — the table assigns it (a `bigserial`/`DEFAULT nextval(...)`
 *   column, a trigger). The INSERT omits the column and reads the value back,
 *   so the id exists only once `create()` resolves.
 * - `{ sequence }` — the app draws the next value from a named sequence and
 *   inserts it, so the id is known before the row is written.
 * - a function — your own scheme, sync or async.
 */
export type IIdStrategy<P> = 'short-uuid' | 'uuid' | 'database' | IIdSequence | IIdGenerator<P>

export const DEFAULT_ID_STRATEGY = 'short-uuid'

const NAMED_GENERATORS: Record<string, () => string> = {
  'short-uuid': generateShortUuid,
  uuid: randomUUID,
}

/**
 * What a backend has to do to get an id, once the option is read.
 *
 * `generated` is self-contained; the other two need the backend, which is why
 * they carry no `next()`: only the backend knows how to reach the database (and
 * how to stand in for it with no database at all).
 */
export type IResolvedIdStrategy<P> =
  | { readonly kind: 'generated'; next(item: P): Promise<string> }
  | { readonly kind: 'database' }
  | { readonly kind: 'sequence'; readonly sequence: string }

export interface IIdStrategyContext {
  /** Named in errors — the repository's table. */
  label: string
  /**
   * Whether this backend can let the table assign the id. False for storage
   * whose table the framework creates itself (Postgres JSONB), where the id
   * column is a plain `TEXT` primary key with no default.
   */
  supportsDatabaseAssigned?: boolean
}

function isSequence(strategy: unknown): strategy is IIdSequence {
  return typeof strategy === 'object' && strategy !== null && 'sequence' in strategy
}

/** Read a repository's `id` option into something a backend can act on. */
export function resolveIdStrategy<P>(
  strategy: IIdStrategy<P> | undefined,
  context: IIdStrategyContext,
): IResolvedIdStrategy<P> {
  const declared = strategy ?? DEFAULT_ID_STRATEGY

  if (declared === 'database') {
    if (context.supportsDatabaseAssigned === false) {
      throw new Error(
        `${context.label}: id: 'database' needs a table whose id column assigns itself, but ` +
          `this repository stores documents in a table the framework creates with a plain ` +
          `TEXT primary key. Extend PgColumnsRepository and own the table in a migration, ` +
          `or draw the id from a sequence with id: { sequence: '...' }.`,
      )
    }
    return { kind: 'database' }
  }

  if (isSequence(declared)) {
    const { sequence } = declared
    if (typeof sequence !== 'string' || sequence.trim() === '') {
      throw new Error(`${context.label}: id: { sequence } needs the name of a database sequence.`)
    }
    return { kind: 'sequence', sequence: sequence.trim() }
  }

  const generate =
    typeof declared === 'function' ? declared : (NAMED_GENERATORS[declared] as IIdGenerator<P>)
  if (!generate) {
    throw new Error(
      `${context.label}: unknown id strategy "${String(declared)}". ` +
        `Use 'short-uuid', 'uuid', 'database', { sequence: '...' }, or a function.`,
    )
  }

  return {
    kind: 'generated',
    async next(item: P): Promise<string> {
      const id = await generate(item)
      if (typeof id !== 'string' || id === '') {
        throw new Error(
          `${context.label}: the id generator returned ${JSON.stringify(id)}; ` +
            `it must return a non-empty string.`,
        )
      }
      return id
    },
  }
}
