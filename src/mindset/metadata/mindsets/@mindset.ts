import 'reflect-metadata'

import { type IConstructor } from '@/core'
import { container, injectable } from '@/injection'
import { type IMindset } from '../../IMindset'
import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { MINDSET_DECORATION_MINDSET } from './decoratorNames'
import { type IMindsetConfig } from './IMindsetConfig'

export function mindset(config?: IMindsetConfig) {
  return function (target: IConstructor<IMindset>) {
    const store = container.resolve(MindsetMetadataStore)
    store.saveMindsetDecoration({
      decorationName: MINDSET_DECORATION_MINDSET,
      constructor: target,
      decorationConfig: config ?? {},
    })
    injectable()(target)
  }
}
