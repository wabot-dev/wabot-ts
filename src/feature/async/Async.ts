import { singleton } from '@/core/injection'
import { Command } from './Command'
import { CommandMetadataStore } from './CommandMetadataStore'
import { Job } from './Job'
import { JobRepository } from './JobRepository'
import { JobsEventsHub } from './JobsEventsHub'
import { IStorableData } from '@/core/storable'

@singleton()
export class Async {
  constructor(
    private jobRepository: JobRepository,
    private handlerContainer: CommandMetadataStore,
    private jobsEventsHub: JobsEventsHub
  ) {}

  async run<T extends IStorableData>(command: Command<T>): Promise<Job> {
    const commandName = this.handlerContainer.getCommandName(command.constructor as any)
    if (!commandName) {
      throw new Error(`${command.constructor.name} is not registered as command`)
    }

    const job = new Job({
      commandName,
      commandData: command['data'],
    })

    await this.jobRepository.create(job)
    this.jobsEventsHub.notifyJobCreated(job)
    return job
  }
}
