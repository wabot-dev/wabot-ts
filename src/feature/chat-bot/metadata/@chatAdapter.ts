import { container } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IChatAdapter } from '../IChatAdapter'
import { ChatAdapterMetadataStore } from './ChatAdapterMetadataStore'

export interface IChatAdapterDecoratorConfig {
  provider: string
}

export function chatAdapter(config: IChatAdapterDecoratorConfig) {
  return function (target: IConstructor<IChatAdapter>) {
    const store = container.resolve(ChatAdapterMetadataStore)
    store.save({ constructor: target, provider: config.provider })
  }
}
