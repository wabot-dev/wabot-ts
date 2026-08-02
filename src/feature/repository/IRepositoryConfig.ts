import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'
import { IIdStrategy } from './idStrategy'
import { IIndexDecl } from './indexes'

export type IRepositoryAuditEvent = 'create' | 'update' | 'destroy'

export interface IRepositoryAuditConfig {
  /** Which lifecycle events to record. Default: all three. */
  events?: IRepositoryAuditEvent[]
  /** Audit stream (→ table `audit_<stream>`). Default: the repository's `table`. */
  stream?: string
  /** Which database the audit stream lives in. Default: the repository's own `pool`. */
  pool?: IConstructor<IDbPoolProvider>
}

/** The data shape an entity carries, so `fields` can be checked against it. */
export type IEntityDataOf<P> = P extends Entity<infer D> ? D : never

// Adapter-specific fields (e.g. `schema`, `add.columns` for Postgres) can be
// included by the caller; the active adapter is responsible for reading them.
export interface IRepositoryConfig<P extends Entity<IEntityData>> {
  table: string
  constructor: IConstructor<P>
  schema?: string
  /**
   * Which database this repository lives in, selected by its `@dbPool` provider
   * class. Omit to use the default database (`DATABASE_URL`). Lets one app talk
   * to several databases (and route CQRS reads to a replica).
   */
  pool?: IConstructor<IDbPoolProvider>
  /**
   * Where a new entity's id comes from. Defaults to `'short-uuid'`, assigned
   * before the INSERT — what every repository did before this option existed.
   *
   * `'uuid'` for a `uuid` column, a function for your own scheme, and
   * `'database'` for a table that assigns the id itself (`bigserial`, a
   * sequence default, a trigger): the INSERT then omits the column and reads
   * the value back, so `item.id` is only readable once `create()` resolves.
   * `'database'` needs a table the app owns — it is not available on the
   * document (JSONB) strategy, whose table the framework creates.
   */
  id?: IIdStrategy<P>
  /**
   * Enable an append-only audit trail for this repository. `true` audits all
   * lifecycle events to a stream named after the table; the object supports
   * selecting events, the stream name, and a separate audit database. Off by
   * default. Destroyed objects can be reviewed and restored via `recover(id)`.
   */
  audit?: boolean | IRepositoryAuditConfig
  /**
   * Index declarations for this repository. Explicit entries are merged with
   * indexes auto-derived from the repository's query methods (`@repository`
   * fills this in); an explicit entry for the same field set overrides the
   * auto one, and `disabled: true` opts out. Ignored by the memory backend.
   */
  indexes?: IIndexDecl[]
  /**
   * Projection: the entity fields this repository reads and writes. Anything
   * outside the list is invisible to it — not loaded, not persisted — which is
   * what makes a repository over a wide or legacy table (or a CQRS read model)
   * possible. Omit it to take every field.
   *
   * Meaningful for storage strategies that map fields to native columns
   * (`PgColumnsRepository`); the document strategy stores the entity whole and
   * ignores it. The memory backend honours it either way, so development
   * without a database behaves like production.
   */
  fields?: Exclude<keyof IEntityDataOf<P>, 'id' | 'createdAt'>[]
  /**
   * Extra top-level columns derived from each entity, on backends that store
   * the entity as a document. They are written on every save and queried
   * natively, so a hot lookup uses a real index instead of digging into the
   * document. Ignored by backends that have no such notion.
   */
  add?: {
    columns: {
      [column: string]: {
        /** Column type in the backend's own DDL, e.g. `'TEXT'`. */
        type: string
        value: (item: P) => boolean | number | string | null | Date
      }
    }
  }
}
