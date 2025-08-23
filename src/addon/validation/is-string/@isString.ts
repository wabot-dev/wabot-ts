import { container } from '@/core/injection'
import { ValidationMetadataStore } from '@/core/validation'
import { validateIsString } from './validateIsString'

export function isString() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsString,
    })
  }
}
