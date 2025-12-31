import { CommandMetadataStore } from './CommandMetadataStore'
import { JobRepository } from './JobRepository'
import { Job } from './Job'
import { container, singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { validateAndTransform } from '@/core/validation'

@singleton()
export class JobRunner {
  private logger = new Logger('wabot:job-runner')
  constructor(
    private jobRepository: JobRepository,
    private handlerContainer: CommandMetadataStore,
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

      const validationResult = validateAndTransform(commandData, commandConstructor)

      if (!validationResult.value) {
        throw new Error('Invalid command data')
      }

      const command = validationResult.value
      this.logger.debug(`start running command ${commandName}`)
      await handler.handle(command)
      this.logger.debug(`command ${commandName} run successfull`)

      job.setAsSuccess()
    } catch (e) {
      this.logger.error(e)
      job.setAsFailed(e instanceof Error ? e : new Error('Invalid Job error'))
    } finally {
      await this.jobRepository.update(job)
    }
  }
}
