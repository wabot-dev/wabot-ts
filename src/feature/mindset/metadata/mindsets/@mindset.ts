import { type IConstructor } from '@/core/generics'
import { container, injectable } from '@/core/injection'
import { type IMindset } from '../../IMindset'
import { MindsetMetadataStore } from '../MindsetMetadataStore'

import { type IMindsetConfig } from './IMindsetConfig'

export function mindset(config?: IMindsetConfig) {
  return function (target: IConstructor<IMindset>) {
    const store = container.resolve(MindsetMetadataStore)
    store.saveMindsetMetadata({
      constructor: target,
      config,
    })
    injectable()(target)
  }
}
