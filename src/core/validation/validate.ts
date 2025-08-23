import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { ValidationMetadataStore } from './metadata/ValidationMetadataStore'
import { IModelValidationResult } from './validators/contracts'
import { validateModel } from './validators/validateModel'

export function validate<V>(
  value: any,
  modelConstructor: IConstructor<V>,
): IModelValidationResult<V> {
  const metadataStore = container.resolve(ValidationMetadataStore)
  const info = metadataStore.getModelValidatorsInfo(modelConstructor)
  return validateModel(value, info)
}
