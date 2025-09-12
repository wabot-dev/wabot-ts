import { container } from '@/core/injection'
import { ValidationMetadataStore } from '../../metadata/ValidationMetadataStore'
import { validateIsBoolean } from './validateIsBoolean'

export function isBoolean() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsBoolean,
    })
  }
}
