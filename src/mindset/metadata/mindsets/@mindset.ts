import 'reflect-metadata'

import { container, injectable } from '@/injection'
import { IConstructor } from '@/shared'
import { IMindset } from '../../IMindset'
import { MindsetMetadataStore } from '../MindsetMetadataStore'
import { MINDSET_DECORATION_MINDSET } from './decoratorNames'
import { IMindsetConfig } from './IMindsetConfig'


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
