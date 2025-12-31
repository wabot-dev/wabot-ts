import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { container } from '@/core/injection'
import { IStorableData } from '@/core/storable'

export interface ICommandConfig {
  name: string
}

export function command<O extends object>(config: ICommandConfig | string) {
  return function (target: IConstructor<IStorableData<O>>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
    metadataStore.registerCommand(target as any, typeof config === 'string' ? config : config.name)
  }
}
