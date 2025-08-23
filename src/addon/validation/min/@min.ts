import { container } from '@/core/injection'
import { ValidationMetadataStore } from '@/core/validation'
import { validateMin } from './validateMin'

export function min(limit: any) {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateMin,
      validatorOptions: { limit },
    })
  }
}
