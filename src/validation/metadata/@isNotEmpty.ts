import { container } from '@/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { validateIsNotEmpty } from '../validators/validateIsNotEmpty'

export function isNotEmpty() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsNotEmpty,
    })
  }
}
