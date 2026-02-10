import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'

export type IPgRepositoryConfig<P extends Entity<IEntityData>> = {
  schema?: string
  table: string
  constructor: IConstructor<P>
  add?: {
    columns: {
      [column: string]: {
        type: string
        value: (item: P) => boolean | number | string | null | Date
      }
    }
  }
}
