import { IStorablePrimitive } from './IStorablePrimitive'

export type IStorableType<T> =
  T extends IStorablePrimitive
    ? T
    : T extends (...args: any[]) => any
      ? never
      : T extends Array<infer U>
        ? Array<IStorableType<U>>
        : T extends object
          ? { [K in keyof T]: IStorableType<T[K]> }
          : never
