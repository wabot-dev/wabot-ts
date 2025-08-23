import { CommandMetadataStore } from './CommandMetadataStore'
import { JobRepository } from './JobRepository'
import { Job } from './Job'
import { container, singleton } from '@/core/injection'

@singleton()
export class JobRunner {
  constructor(
    private jobRepository: JobRepository,
    private handlerContainer: CommandMetadataStore
  ) {}

  async run(job: Job) {
    try {
      const { commandName, commandData } = job['data']

      const handlerConstructor = this.handlerContainer.getHandlerForCommandName(commandName)
      if (!handlerConstructor) {
        throw new Error(`Not found handler for command '${commandName}'`)
      }

      const handler = container.resolve(handlerConstructor)

      const commandConstructor = this.handlerContainer.getCommandForCommandName(commandName)
      if (!commandConstructor) {
        throw new Error(`Not found class for command name '${commandName}'`)
      }

      job.setAsStarted()
      await this.jobRepository.update(job)

      const command = new commandConstructor(commandData)
      await handler.handle(command)
      job.setAsSuccess()
    } catch (e) {
      job.setAsFailed(e instanceof Error ? e : new Error('Invalid Job error'))
    } finally {
      await this.jobRepository.update(job)
    }
  }
}
