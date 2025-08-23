
import { IConstructor } from '@/core/generics'
import { CommandMetadataStore } from './CommandMetadataStore'
import { container } from '@/core/injection'

export interface ICommandConfig {
  name?: string
}

export function command(config?: ICommandConfig) {
  return function (target: IConstructor<any>) {
    const handlerContainer = container.resolve(CommandMetadataStore)
    handlerContainer.registerCommand(target, config?.name ?? target.name)
  }
}
