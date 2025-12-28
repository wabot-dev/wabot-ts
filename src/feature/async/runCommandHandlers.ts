import { ICommandHandler } from './ICommandHandler'
import { CommandMetadataStore } from './CommandMetadataStore'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { JobManager } from './JobManager'

export function runAsyncCommandHandlers(handlers: IConstructor<ICommandHandler<any>>[]) {
  const jobManager = container.resolve(JobManager)
  const metadataStore = container.resolve(CommandMetadataStore)
  handlers.forEach((handler) => metadataStore.activateCommandHandler(handler))
  jobManager.run()
}
