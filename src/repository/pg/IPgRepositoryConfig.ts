import type { IConstructor, Persistent } from '@/core'

export type IPgRepositoryConfig<P extends Persistent> = {
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
