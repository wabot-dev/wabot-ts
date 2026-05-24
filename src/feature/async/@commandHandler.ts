import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { ICommandHandler } from './ICommandHandler'
import { container, injectable } from '@/core/injection'
import { IStorableData } from '@/core/storable'
import { IJobOptions } from './IJobOptions'
import { IDedupConfig } from './IDedupConfig'

export interface ICommandHandlerConfig<C extends object> extends IJobOptions {
  command: IConstructor<IStorableData<C>>
  dedup?: IDedupConfig
}

export function commandHandler<C extends object>(
  config: ICommandHandlerConfig<C> | IConstructor<IStorableData<C>>,
) {
  return function (target: IConstructor<ICommandHandler<C>>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
    const isCtor = typeof config === 'function'
    const command = isCtor ? config : config.command
    const options: IJobOptions = isCtor
      ? {}
      : {
          reintentsDelaysInSeconds: config.reintentsDelaysInSeconds,
          aceptableRunningTimeSeconds: config.aceptableRunningTimeSeconds,
          stuckRetryAttempts: config.stuckRetryAttempts,
        }
    const dedup = isCtor ? undefined : config.dedup
    metadataStore.registerCommandHandler(command, target, options, dedup)
    injectable()(target)
  }
}
