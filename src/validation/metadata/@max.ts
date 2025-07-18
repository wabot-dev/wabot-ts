import { container } from '@/injection'
import { ValidationMetadataStore } from './ValidationMetadataStore'
import { validateMax } from '../validators/validateMax'

export function max(limit: any) {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateMax,
      validatorOptions: { limit },
    })
  }
}
