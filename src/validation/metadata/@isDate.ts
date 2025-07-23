import { container } from '@/injection'
import { validateIsDate } from '../validators/validateIsDate'
import { ValidationMetadataStore } from './ValidationMetadataStore'

export function isDate() {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsDate,
    })
  }
}
