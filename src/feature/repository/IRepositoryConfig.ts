import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'
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
}
