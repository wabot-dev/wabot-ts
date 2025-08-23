export type IPrimitive = null | number | string | boolean | undefined

export type IStorableData = {
  [key: string]: IPrimitive | IPrimitive[] | IStorableData | IStorableData[]
}

export class Storable<D extends IStorableData> {
  constructor(protected data: D) {}
}
