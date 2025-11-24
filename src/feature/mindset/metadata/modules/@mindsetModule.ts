import { container, injectable } from '@/core/injection'
import { type IConstructor } from '@/core/generics'
import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { type IMindsetModuleConfig } from './IMindsetModuleConfig'

export function mindsetModule<A>(config?: IMindsetModuleConfig) {
  return function (target: IConstructor<A>) {
    const store = container.resolve(MindsetMetadataStore)
    store.saveModuleMetadata({
      constructor: target,
      config: config,
    })
    injectable()(target)
  }
}
