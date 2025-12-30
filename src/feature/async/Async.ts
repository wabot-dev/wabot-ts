import { singleton } from '@/core/injection'
import { IStorableData } from '@/core/storable'
import { Command } from './Command'
import { CommandMetadataStore } from './CommandMetadataStore'
import { Job } from './Job'
import { JobRepository } from './JobRepository'
import { JobScheduler } from './JobScheduler'

@singleton()
export class Async {
  constructor(
    private jobRepository: JobRepository,
    private metadataStore: CommandMetadataStore,
    private jobScheduler: JobScheduler,
  ) {}

  async runCommand<T extends IStorableData>(command: Command<T>): Promise<Job> {
    const commandName = this.metadataStore.getCommandName(command.constructor as any)
    if (!commandName) {
      throw new Error(`${command.constructor.name} is not registered as command`)
    }

    const job = new Job({
      commandName,
      commandData: command['data'],
      scheduledAt: new Date().getTime(),
    })

    await this.jobRepository.create(job)
    this.jobScheduler.tryExecuteNow(job)
    return job
  }
}
