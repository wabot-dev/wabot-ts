import { container } from '@/core/injection'
import { IValidateIsInOptions, validateIsIn } from './validateIsIn'
import { ValidationMetadataStore } from '../../metadata/ValidationMetadataStore'

export function isIn(values: IValidateIsInOptions['values']) {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateIsIn,
      validatorOptions: { values },
    })
  }
}
