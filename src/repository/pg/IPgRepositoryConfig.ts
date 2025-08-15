import type { IConstructor, Entity, IEntityData } from '@/core'

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
