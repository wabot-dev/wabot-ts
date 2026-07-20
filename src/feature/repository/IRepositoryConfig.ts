import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'
import { IIndexDecl } from './indexes'

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
   * Index declarations for this repository. Explicit entries are merged with
   * indexes auto-derived from the repository's query methods (`@repository`
   * fills this in); an explicit entry for the same field set overrides the
   * auto one, and `disabled: true` opts out. Ignored by the memory backend.
   */
  indexes?: IIndexDecl[]
}
