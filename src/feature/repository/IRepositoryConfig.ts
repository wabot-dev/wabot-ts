import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IIndexDecl } from './indexes'

// Adapter-specific fields (e.g. `schema`, `add.columns` for Postgres) can be
// included by the caller; the active adapter is responsible for reading them.
export interface IRepositoryConfig<P extends Entity<IEntityData>> {
  table: string
  constructor: IConstructor<P>
  schema?: string
  /**
   * Index declarations for this repository. Explicit entries are merged with
   * indexes auto-derived from the repository's query methods (`@repository`
   * fills this in); an explicit entry for the same field set overrides the
   * auto one, and `disabled: true` opts out. Ignored by the memory backend.
   */
  indexes?: IIndexDecl[]
}
