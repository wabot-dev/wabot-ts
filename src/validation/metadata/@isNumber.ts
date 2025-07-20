import { container } from '@/injection'
import { validateIsNumber } from '../validators/validateIsNumber'
import { ValidationMetadataStore } from './ValidationMetadataStore'

export function isNumber() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsNumber,
    })
  }
}
