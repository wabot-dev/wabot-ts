import { container } from '@/core/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { _IS_OPTIONAL_DUMMY_VALIDATOR_ } from '../validators/validateIsOptional'

export function isOptional() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: _IS_OPTIONAL_DUMMY_VALIDATOR_,
    })
  }
}
