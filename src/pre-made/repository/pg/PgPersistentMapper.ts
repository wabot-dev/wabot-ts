import type { IConstructor, IPersistent, IReversibleMapper, Persistent } from '@/shared'
import type { IPgRecord } from './IPgRecord'

export class PgPersistentMapper<P extends Persistent<IPersistent>>
  implements IReversibleMapper<P, IPgRecord>
{
  constructor(private ctor: IConstructor<P>) {}

  map(input: P): IPgRecord {
    return { id: input.getId(), data: JSON.stringify(input['data']) }
  }

  rev(input: IPgRecord): P {
    return new this.ctor(input.data)
  }
}

export function pgMapperFor<P extends Persistent<IPersistent>>(ctor: IConstructor<P>) {
  return new PgPersistentMapper(ctor)
}
