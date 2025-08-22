import { container } from '@/injection'
import { IValidateArrayOptions, validateArray } from '../validators/validateArray'
import { ValidationMetadataStore } from './ValidationMetadataStore'

export function isArray(options?: IValidateArrayOptions) {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateArray,
      validatorOptions: options,
    })
  }
}
