import { IConstructor } from '@/core/generics'
import { CommandMetadataStore } from './CommandMetadataStore'
import { container } from '@/core/injection'

export interface ICommandConfig {
  name: string
}

export function command(config: ICommandConfig | string) {
  return function (target: IConstructor<any>) {
    const metadataStore = container.resolve(CommandMetadataStore)
    metadataStore.registerCommand(target, typeof config === 'string' ? config : config.name)
  }
}
