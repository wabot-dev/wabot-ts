import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { ValidationMetadataStore } from './metadata/ValidationMetadataStore'
import { IModelValidationResult } from './core/contracts'
import { validateModel } from './core/validateModel'

export type IValidateInputShape<T> = T extends Date
  ? Date
  : T extends Array<infer U>
    ? Array<IValidateInputShape<U>>
    : T extends object
      ? {
          [K in keyof T]: IValidateInputShape<T[K]>
        }
      : T

export function validateAndTransform<V>(
  value: IValidateInputShape<V>,
  modelConstructor: IConstructor<V>,
): IModelValidationResult<V> {
  const metadataStore = container.resolve(ValidationMetadataStore)
  const info = metadataStore.getModelValidatorsInfo(modelConstructor)
  return validateModel(value, info)
}
