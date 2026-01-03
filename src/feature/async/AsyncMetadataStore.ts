import { singleton } from '@/core/injection'
import { ICommandHandler } from './ICommandHandler'
import { IConstructor } from '@/core/generics'
import { IStorableData } from '@/core/storable'
import { ICronHandler } from './ICronHandler'
import { ICronMetadata } from './ICronMetadata'
import { ICronJobScheduleConfig } from './ICronJobScheduleConfig'

@singleton()
export class AsyncMetadataStore {
  private handlersMap = new Map<string, IConstructor<ICommandHandler<any>>>()
  private handlersInverseMap = new Map<IConstructor<ICommandHandler<any>>, string>()
  private commandsMap = new Map<string, IConstructor<any>>()
  private commandsInverseMap = new Map<IConstructor<any>, string>()

  private cronsMap = new Map<IConstructor<ICronHandler>, ICronMetadata[]>()

  registerCron(cron: IConstructor<ICronHandler>, config: ICronJobScheduleConfig) {
    let ctorCrons = this.cronsMap.get(cron)
    if (!ctorCrons) {
      this.cronsMap.set(cron, (ctorCrons = []))
    }

    ctorCrons.push({ handlerConstructor: cron, config })
    this.handlersMap.set(config.commandName, cron)
  }

  requireCronMetadata(cron: IConstructor<ICronHandler>) {
    const metadata = this.cronsMap.get(cron)
    if (!metadata) {
      throw new Error(`cron ${cron.name} is not registered`)
    }
    return metadata
  }

  registerCommand(command: IConstructor<any>, commandName: string) {
    this.commandsMap.set(commandName, command)
    this.commandsInverseMap.set(command, commandName)
  }

  registerCommandHandler<C extends object>(
    command: IConstructor<IStorableData<C>>,
    handlerConstructor: IConstructor<ICommandHandler<C>>,
  ) {
    let commandName = this.commandsInverseMap.get(command)

    if (!commandName) {
      throw new Error(`Should use @command decorator on command class ${command.name}`)
    }

    this.handlersMap.set(commandName, handlerConstructor)
    this.handlersInverseMap.set(handlerConstructor, commandName)
  }

  getHandlerForCommandName(commandName: string): IConstructor<ICommandHandler<any>> | null {
    return this.handlersMap.get(commandName) ?? null
  }

  getCommandNameForHandler(handlerConstructor: IConstructor<ICommandHandler<any>>): string | null {
    return this.handlersInverseMap.get(handlerConstructor) ?? null
  }

  requireCommandNameForHandler(handlerConstructor: IConstructor<ICommandHandler<any>>): string {
    const commmandName = this.handlersInverseMap.get(handlerConstructor) ?? null
    if (!commmandName)
      throw new Error(`Can't found a registered command for ${handlerConstructor.name}`)
    return commmandName
  }

  getCommandName(command: IConstructor<any>): string | null {
    return this.commandsInverseMap.get(command) ?? null
  }

  getCommandForCommandName(commandName: string): IConstructor<any> | null {
    return this.commandsMap.get(commandName) ?? null
  }
}
