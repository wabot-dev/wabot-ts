import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IIndexDecl } from '@/feature/repository'

export type IPgRepositoryConfig<P extends Entity<IEntityData>> = {
  schema?: string
  table: string
  constructor: IConstructor<P>
  /** Explicit + auto-derived indexes (populated by `@repository`). */
  indexes?: IIndexDecl[]
  /**
   * Relational (pg-sql strategy) only: the entity fields stored as real
   * top-level columns. Column name equals the field name (id/createdAt map to
   * the reserved id/created_at columns). The table and columns are created by
   * migrations, not auto-DDL. Ignored by the JSONB strategy.
   */
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
