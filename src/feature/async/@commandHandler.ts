import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { ICommandHandler } from './ICommandHandler'
import { container, injectable } from '@/core/injection'
import { IStorableData } from '@/core/storable'

export interface ICommandHandlerConfig<C extends object> {
  command: IConstructor<IStorableData<C>>
}

export function commandHandler<C extends object>(
  config: ICommandHandlerConfig<C> | IConstructor<IStorableData<C>>,
) {
  return function (target: IConstructor<ICommandHandler<C>>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
    metadataStore.registerCommandHandler(
      typeof config === 'function' ? config : config.command,
      target,
    )
    injectable()(target)
  }
}
