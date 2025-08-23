import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { ValidationMetadataStore } from './metadata/ValidationMetadataStore'

export function modelInfo<V>(modelConstructor: IConstructor<V>) {
  const metadataStore = container.resolve(ValidationMetadataStore)
  return metadataStore.getModelValidatorsInfo(modelConstructor)
}
