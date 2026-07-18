import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IIndexDecl } from '@/feature/repository'

export type IPgRepositoryConfig<P extends Entity<IEntityData>> = {
  schema?: string
  table: string
  constructor: IConstructor<P>
  /** Explicit + auto-derived indexes (populated by `@repository`). */
  indexes?: IIndexDecl[]
  add?: {
    columns: {
      [column: string]: {
        type: string
        value: (item: P) => boolean | number | string | null | Date
      }
    }
  }
}
