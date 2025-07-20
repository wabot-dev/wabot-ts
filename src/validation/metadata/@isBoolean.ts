import { container } from '@/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { validateIsBoolean } from '../validators/validateIsBoolean'

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
