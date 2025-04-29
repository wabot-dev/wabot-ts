import type { IConstructor, IPersistent, IReversibleMapper, Persistent } from '@/shared'

export class SqlitePersistentMapper<P extends Persistent<IPersistent>>
  implements IReversibleMapper<P, string>
{
  constructor(private ctor: IConstructor<P>) {}

  map(input: P): string {
    return JSON.stringify(input['data'])
  }

  rev(input: string): P {
    return new this.ctor(JSON.parse(input))
  }
}

export function sqliteMapperFor<P extends Persistent<IPersistent>>(ctor: IConstructor<P>) {
  return new SqlitePersistentMapper(ctor)
}
