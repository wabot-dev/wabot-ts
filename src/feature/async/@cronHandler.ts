import { IConstructor } from '@/core/generics'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { container, singleton } from '@/core/injection'
import { ICronHandler } from './ICronHandler'
import { IJobOptions } from './IJobOptions'

export interface ICronConfig extends IJobOptions {
  name: string
  cron: string
  disabled?: boolean
  maxRunningJobs?: number
  misfirePolicy?: 'RUN_ONCE' | 'RUN_ALL' | 'SKIP'
}

export function cronHandler(config: ICronConfig) {
  return function (target: IConstructor<ICronHandler>) {
    const metadataStore = container.resolve(AsyncMetadataStore)
    metadataStore.registerCron(target, {
      name: config.name,
      commandName: `cron:${config.name}`,
      cron: config.cron,
      enabled: !config.disabled,
      maxRunningJobs: config.maxRunningJobs,
      misfirePolicy: config.misfirePolicy,
      reintentsDelaysInSeconds: config.reintentsDelaysInSeconds,
      aceptableRunningTimeSeconds: config.aceptableRunningTimeSeconds,
      stuckRetryAttempts: config.stuckRetryAttempts,
    })
    singleton()(target)
  }
}
