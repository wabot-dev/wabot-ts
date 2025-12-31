import { IStorableData } from './IStorableData'

export class Storable<D extends object> {
  constructor(protected data: IStorableData<D>) {}
}
