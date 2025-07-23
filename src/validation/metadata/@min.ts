import { container } from '@/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { validateMin } from '../validators/validateMin'

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
