import 'reflect-metadata'

import { container, injectable } from '@/injection'
import { IConstructor } from '@/shared'
import { MindsetMetadataStore } from '../MindsetMetadataStore'

export const MINDSET_MODULE_DECORATION_MODULE = 'mindsetModule'

export interface IMindsetModuleConfig {
  description: string
}

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
