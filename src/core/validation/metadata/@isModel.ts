import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { validateModel } from '../core/validateModel'
import { ValidationMetadataStore } from './ValidationMetadataStore'

export function isModel(model: IConstructor<any>) {
  return function (target: object, propertyKey: string | symbol) {
    const propertyName = propertyKey.toString()
    const store = container.resolve(ValidationMetadataStore)
    store.saveValidatorMetadata({
      modelConstructor: target.constructor as any,
      propertyName,
      validator: validateModel,
      validatorOptions: store.getModelValidatorsInfo(model),
    })
  }
}
