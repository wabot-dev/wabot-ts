import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IIdStrategy, IIndexDecl } from '@/feature/repository'

export type IPgRepositoryConfig<P extends Entity<IEntityData>> = {
  schema?: string
  table: string
  constructor: IConstructor<P>
  /** Where a new entity's id comes from. Default: a short UUID set before the INSERT. */
  id?: IIdStrategy<P>
  /** Explicit + auto-derived indexes (populated by `@repository`). */
  indexes?: IIndexDecl[]
  /**
   * Column strategy only: the projection of entity fields this repository reads
   * and writes. Column name equals the field name (id/createdAt map to the
   * reserved id/created_at columns). Omit to take the whole row. Ignored by the
   * document (JSONB) strategy.
   */
  fields?: string[]
  /** @deprecated Renamed to `fields`. */
  columns?: string[]
  add?: {
    columns: {
      [column: string]: {
        type: string
        value: (item: P) => boolean | number | string | null | Date
      }
    }
  }
}
