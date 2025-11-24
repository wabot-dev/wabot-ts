import { container } from '@/core/injection'
import { IValidateArrayOptions, validateArray } from '../core/validateArray'
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
      typeDescriptor: 'array'
    })
  }
}
