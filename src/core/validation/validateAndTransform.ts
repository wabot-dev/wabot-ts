import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { ValidationMetadataStore } from './metadata/ValidationMetadataStore'
import { IModelValidationResult } from './core/contracts'
import { validateModel } from './core/validateModel'

export type IValidateInputShape<V> = {
  [K in keyof V]: V[K] extends Date ? string | number | Date : V[K]
}

export function validateAndTransform<V>(
  value: IValidateInputShape<V>,
  modelConstructor: IConstructor<V>,
): IModelValidationResult<V> {
  const metadataStore = container.resolve(ValidationMetadataStore)
  const info = metadataStore.getModelValidatorsInfo(modelConstructor)
  return validateModel(value, info)
}
