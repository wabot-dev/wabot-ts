import { container } from '@/core/injection'
import { validateIsDate } from './validateIsDate'
import { ValidationMetadataStore } from '@/core/validation'

export function isDate() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsDate,
    })
  }
}
