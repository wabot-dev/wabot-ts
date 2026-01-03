import { IStorableType } from './IStorableType'

export type IStorableData<O extends object> = {
  [K in keyof O]: IStorableType<O[K]>
}
