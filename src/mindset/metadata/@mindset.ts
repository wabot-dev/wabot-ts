import 'reflect-metadata'

import { container, injectable } from '@/injection'
import { IConstructor } from '@/shared'
import { IMindset } from '../IMindset'
import { MindsetMetadataStore } from './MindsetMetadataStore'

export const MINDSET_DECORATION_MINDSET = 'mindset'

export interface IMindsetConfig {
  modules?: IConstructor<any>[]
}

export function mindset(config: IMindsetConfig) {
  return function (target: IConstructor<IMindset>) {
    const store = container.resolve(MindsetMetadataStore)
    store.saveMindsetDecoration({
      decorationName: MINDSET_DECORATION_MINDSET,
      constructor: target,
      decorationConfig: config,
    })
    injectable()(target)
  }
}
