import 'reflect-metadata'

import { container, injectable } from '@/injection'
import { type IConstructor } from '@/shared'
import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { MINDSET_MODULE_DECORATION_MODULE } from './decoratorNames'
import { type IMindsetModuleConfig } from './IMindsetModuleConfig'

export function mindsetModule<A>(config: IMindsetModuleConfig) {
  return function (target: IConstructor<A>) {
    const store = container.resolve(MindsetMetadataStore)
    store.saveModuleDecoration({
      decorationName: MINDSET_MODULE_DECORATION_MODULE,
      constructor: target,
      decorationConfig: config,
    })
    injectable()(target)
  }
}
