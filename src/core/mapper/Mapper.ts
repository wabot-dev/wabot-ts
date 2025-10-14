import { Storable } from '@/core/storable'
import { CustomError } from '@/core/error'
import { IValidateInputShape, validateAndTransform } from '@/core/validation'
import { IConstructor } from '@/core/generics'

function deepCopyWithStorable(obj: any, visited = new WeakMap()): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return obj.getTime()
  }

  if (obj instanceof Storable) {
    const dataCopy = deepCopyWithStorable(obj['data'], visited)
    const result = { ...dataCopy }

    // Handle getters from prototype
    const proto = Object.getPrototypeOf(obj)
    const descriptors = Object.getOwnPropertyDescriptors(proto)

    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (typeof descriptor.get === 'function') {
        try {
          const value = (obj as any)[key]
          result[key] = deepCopyWithStorable(value, visited)
        } catch {
          // Silently ignore getters that throw
        }
      }
    }

    return result
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepCopyWithStorable(item, visited))
  }

  const copy: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCopyWithStorable(obj[key], visited)
    }
  }
  return copy
}

export class Mapper {
  map<T>(data: IValidateInputShape<T>, ctor: IConstructor<T>): T {
    const validationResult = validateAndTransform(deepCopyWithStorable(data), ctor)
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
