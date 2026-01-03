import { singleton } from '@/core/injection'
import { AsyncMetadataStore } from './AsyncMetadataStore'
import { Job } from './Job'
import { JobRepository } from './JobRepository'
import { JobScheduler } from './JobScheduler'
import { IValidateInputShape, validateAndTransform } from '@/core/validation'
import { IConstructor } from '@/core/generics'

@singleton()
export class Async {
  constructor(
    private jobRepository: JobRepository,
    private metadataStore: AsyncMetadataStore,
    private jobScheduler: JobScheduler,
  ) {}

  async runCommand<T>(ctor: IConstructor<T>, data: IValidateInputShape<T>): Promise<Job> {
    const commandName = this.metadataStore.getCommandName(ctor)
    if (!commandName) {
      throw new Error(`${ctor.name} is not registered as command`)
    }

    const { error, value: commandData } = validateAndTransform(data, ctor)

    if (!commandData) {
      throw new Error('Invalid command data')
    }

    const job = new Job({
      commandName,
      commandData,
      scheduledAt: new Date().getTime(),
    })

    await this.jobRepository.create(job)
    this.jobScheduler.tryExecuteNow(job)
    return job
  }
}
