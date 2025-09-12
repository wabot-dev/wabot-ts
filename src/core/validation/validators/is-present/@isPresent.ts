import { container } from '@/core/injection'
import { ValidationMetadataStore } from '../../metadata/ValidationMetadataStore'
import { validateIsPresent } from './validateIsPresent'

export function isPresent() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsPresent,
    })
  }
}
