import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { CronScheduler } from './CronScheduler'
import { ICronHandler } from './ICronHandler'

export function runCronHandlers(handlers: IConstructor<ICronHandler>[]) {
  const metadataStore = container.resolve(AsyncMetadataStore)
  const cronScheduler = container.resolve(CronScheduler)

  const cronsMetadata = handlers.map((x) => metadataStore.requireCronMetadata(x)).flat()
  cronScheduler.start(cronsMetadata.map((x) => x.config))
}

export function stopCronHandlers(handlers: IConstructor<ICronHandler>[]) {
  const metadataStore = container.resolve(AsyncMetadataStore)
  const cronScheduler = container.resolve(CronScheduler)

  const cronsMetadata = handlers.map((x) => metadataStore.requireCronMetadata(x)).flat()
  cronScheduler.stop(cronsMetadata.map((x) => x.config))
}
