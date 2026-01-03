import { ICommandHandler } from './ICommandHandler'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { JobScheduler } from './JobScheduler'
import { JobWatchdog } from './JobWatchdog'

export function runCommandHandlers(handlers: IConstructor<ICommandHandler<any>>[]) {
  const jobScheduler = container.resolve(JobScheduler)
  const jobWatchdog = container.resolve(JobWatchdog)
  const metadataStore = container.resolve(AsyncMetadataStore)

  const commands = handlers.map((x) => metadataStore.requireCommandNameForHandler(x))
  jobScheduler.start(commands)
  jobWatchdog.start(commands)
}

export function stopCommandHandlers(handlers: IConstructor<ICommandHandler<any>>[]) {
  const jobScheduler = container.resolve(JobScheduler)
  const jobWatchdog = container.resolve(JobWatchdog)
  const metadataStore = container.resolve(AsyncMetadataStore)

  const commands = handlers.map((x) => metadataStore.requireCommandNameForHandler(x))
  jobScheduler.stop(commands)
  jobWatchdog.stop(commands)
}
