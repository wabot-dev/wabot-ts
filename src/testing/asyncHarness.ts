import { Auth } from '@/core/auth'
import { IConstructor } from '@/core/generics'
import { container, Container, DependencyContainer } from '@/core/injection'
import { IValidateInputShape } from '@/core/validation'
import { AsyncMetadataStore, ICronHandler } from '@/feature/async'

import { assertValid } from './validation'

export interface IAsyncHarnessOptions {
  /** Extra DI registrations for handler dependencies: [token, instance]. */
  register?: [any, any][]
  /** Assigned to the container-scoped Auth. */
  authInfo?: object
}

/**
 * Executes @command handlers and @cronHandler jobs inline — no PostgreSQL,
 * no polling workers — with the same validation production applies.
 */
export class AsyncHarness {
  readonly container: DependencyContainer

  constructor(options: IAsyncHarnessOptions = {}) {
    const child = container.createChildContainer()
    child.register(Container, { useValue: child })

    for (const [token, instance] of options.register ?? []) {
      child.registerInstance(token, instance)
    }

    if (options.authInfo) {
      const auth = child.resolve(Auth) as Auth<object>
      auth.assign(options.authInfo)
    }

    this.container = child
  }

  /**
   * Validate the command data and run its handler immediately, like the
   * JobRunner does for a scheduled job. Returns the transformed command.
   */
  async execute<C>(
    commandConstructor: IConstructor<C>,
    data: IValidateInputShape<C> = {} as IValidateInputShape<C>,
  ): Promise<C> {
    const store = container.resolve(AsyncMetadataStore)

    const commandName = store.getCommandName(commandConstructor)
    if (!commandName) {
      throw new Error(
        `AsyncHarness: ${commandConstructor.name} is not registered with the @command decorator`,
      )
    }

    const handlerConstructor = store.getHandlerForCommandName(commandName)
    if (!handlerConstructor) {
      throw new Error(`AsyncHarness: no @commandHandler registered for command '${commandName}'`)
    }

    const command = assertValid(commandConstructor, data)
    const handler = this.container.resolve(handlerConstructor)
    await handler.handle(command)
    return command
  }

  /** Run a @cronHandler's handle() once, immediately. */
  async runCron(cronConstructor: IConstructor<ICronHandler>): Promise<void> {
    const store = container.resolve(AsyncMetadataStore)
    store.requireCronMetadata(cronConstructor)
    const handler = this.container.resolve(cronConstructor)
    await handler.handle()
  }
}

export function createAsyncHarness(options: IAsyncHarnessOptions = {}): AsyncHarness {
  return new AsyncHarness(options)
}
