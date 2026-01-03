import { AsyncMetadataStore } from './AsyncMetadataStore'
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
    private handlerContainer: AsyncMetadataStore,
  ) {}

  async run(job: Job) {
    try {
      const { commandName, commandData } = job

      const handlerConstructor = this.handlerContainer.getHandlerForCommandName(commandName)
      if (!handlerConstructor) {
        throw new Error(`Not found handler for command '${commandName}'`)
      }

      const handler = container.resolve(handlerConstructor)

      const commandConstructor = this.handlerContainer.getCommandForCommandName(commandName)
      if (commandConstructor === undefined && commandData != undefined) {
        throw new Error(`Not found class for validate data of command '${commandName}'`)
      }

      job.setAsStarted()
      await this.jobRepository.update(job)

      let command: any = undefined

      if (commandConstructor) {
        const validationResult = validateAndTransform(commandData, commandConstructor)
        if (!validationResult.value) {
          throw new Error('Invalid command data')
        }
        command = validationResult.value
      }

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
