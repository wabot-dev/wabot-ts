import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { container } from '@/core/injection'
import { ICommandHandler } from './ICommandHandler'

export interface ICronCommandConfig<C extends object> {
  name: string
  cron: string
  command: C
  disabled?: boolean
}

export function cronCommand<C extends object>(config: ICronCommandConfig<C>) {
  return function (target: IConstructor<ICommandHandler<C>>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
  }
}
