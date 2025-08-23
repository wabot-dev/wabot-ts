import { Storable } from '@/core/storable'
import { CustomError } from '@/core/error'
import { validate } from '@/core/validation'
import { IConstructor } from '@/core/generics'

function deepCopyWithStorable(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return obj.getTime()
  }

  if (obj instanceof Storable) {
    return deepCopyWithStorable(obj['data'])
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepCopyWithStorable(item))
  }

  const copy: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCopyWithStorable(obj[key])
    }
  }
  return copy
}

export class Mapper {
  map<T>(data: any, ctor: IConstructor<T>): T {
    const validationResult = validate(deepCopyWithStorable(data), ctor)
    if (validationResult.error) {
      throw new CustomError({
        httpCode: 500,
        message: `Cant map value to ${ctor.name}`,
        info: validationResult.error,
      })
    }
    return validationResult.value
  }
}
