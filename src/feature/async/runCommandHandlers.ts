import { ICommandHandler } from './ICommandHandler'
import { CommandMetadataStore } from './CommandMetadataStore'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { JobScheduler } from './JobScheduler'
import { JobWatchdog } from './JobWatchdog'

export function runAsyncCommandHandlers(handlers: IConstructor<ICommandHandler<any>>[]) {
  const jobScheduler = container.resolve(JobScheduler)
  const jobWatchdog = container.resolve(JobWatchdog)
  const metadataStore = container.resolve(CommandMetadataStore)

  const commands = handlers.map((x) => metadataStore.requireCommandNameForHandler(x))
  jobScheduler.start(commands)
  jobWatchdog.start(commands)
}
