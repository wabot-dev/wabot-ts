import { container } from '@/core/injection'
import { validateIsNumber } from './validateIsNumber'
import { ValidationMetadataStore } from '../../metadata/ValidationMetadataStore'

export function isNumber() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsNumber,
      typeDescriptor: 'number'
    })
  }
}
