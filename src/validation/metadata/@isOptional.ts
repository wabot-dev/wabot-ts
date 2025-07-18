import { container } from '@/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'

export const _IS_OPTIONAL_DUMMY_VALIDATOR_ = (value: any) => {
  return { value, errors: [] }
}

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
