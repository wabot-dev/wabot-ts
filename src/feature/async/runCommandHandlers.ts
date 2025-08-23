import { ICommandHandler } from './ICommandHandler'
import { JobsEventsHub } from './JobsEventsHub'
import { JobRunner } from './JobRunner'
import { CommandMetadataStore } from './CommandMetadataStore'
import { JobRepository } from './JobRepository'
import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'

export function runAsyncCommandHandlers(handlers: IConstructor<ICommandHandler<any>>[]) {
  const eventsHub = container.resolve(JobsEventsHub)
  const jobRunner = container.resolve(JobRunner)
  const jobRepository = container.resolve(JobRepository)
  const commandsHandlersContainer = container.resolve(CommandMetadataStore)

  const handledCommands = handlers
    .map((x) => commandsHandlersContainer.getCommandNameForHandler(x))
    .filter((x) => x)
    .map((x) => x!)

  eventsHub.listenJobsEvents(async (event) => {
    try {
      const job = await jobRepository.findOrThrow(event.jobId)
      if (handledCommands.includes(job.commandName)) {
        jobRunner.run(job)
      }
    } catch (e) {
      console.error(e)
    }
  })
}
