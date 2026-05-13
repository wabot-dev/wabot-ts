import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { container, singleton } from '@/core/injection'
import { ICronHandler } from './ICronHandler'

export interface ICronConfig {
  name: string
  cron: string
  disabled?: boolean
}

export function cronHandler(config: ICronConfig) {
  return function (target: IConstructor<ICronHandler>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
    metadataStore.registerCron(target, {
      name: config.name,
      commandName: `cron:${config.name}`,
      cron: config.cron,
      enabled: !config.disabled,
    })
    singleton()(target)
  }
}
