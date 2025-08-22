import { IConstructor } from '@/core'
import { container } from '@/injection'
import { ValidationMetadataStore } from './metadata/ValidationMetadataStore'

export function modelInfo<V>(modelConstructor: IConstructor<V>) {
  const metadataStore = container.resolve(ValidationMetadataStore)
  return metadataStore.getModelValidatorsInfo(modelConstructor)
}
