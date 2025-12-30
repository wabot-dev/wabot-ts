import { singleton } from '@/core/injection'
import { Command } from './Command'
import { ICommandHandler } from './ICommandHandler'
import { IConstructor } from '@/core/generics'

@singleton()
export class CommandMetadataStore {
  private handlersMap = new Map<string, IConstructor<ICommandHandler<any>>>()
  private handlersInverseMap = new Map<IConstructor<ICommandHandler<any>>, string>()
  private commandsMap = new Map<string, IConstructor<Command<any>>>()
  private commandsInverseMap = new Map<IConstructor<Command<any>>, string>()

  registerCommand(command: IConstructor<Command<any>>, commandName: string) {
    this.commandsMap.set(commandName, command)
    this.commandsInverseMap.set(command, commandName)
  }

  registerCommandHandler(
    command: IConstructor<Command<any>>,
    handlerConstructor: IConstructor<ICommandHandler<any>>,
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

  getCommandName(command: IConstructor<Command<any>>): string | null {
    return this.commandsInverseMap.get(command) ?? null
  }

  getCommandForCommandName(commandName: string): IConstructor<Command<any>> | null {
    return this.commandsMap.get(commandName) ?? null
  }
}
