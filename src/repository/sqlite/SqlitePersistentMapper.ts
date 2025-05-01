import type { Persistent } from '@/core'
import type { IConstructor, IReversibleMapper } from '@/core'

export class SqlitePersistentMapper<P extends Persistent> implements IReversibleMapper<P, string> {
  constructor(private ctor: IConstructor<P>) {}

  map(input: P): string {
    return JSON.stringify(input['data'])
  }

  rev(input: string): P {
    return new this.ctor(JSON.parse(input))
  }
}

export function sqliteMapperFor<P extends Persistent>(ctor: IConstructor<P>) {
  return new SqlitePersistentMapper(ctor)
}
